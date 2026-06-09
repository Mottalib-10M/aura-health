###############################################################################
# Uzavita - Production Environment
# Production-grade instance sizes, full HA, encryption, monitoring
###############################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "uzavita-terraform-state"
    key            = "environments/prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "uzavita-terraform-locks"
  }
}

# =============================================================================
# Provider
# =============================================================================
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "uzavita"
      Environment = "production"
      ManagedBy   = "terraform"
      HIPAA       = "true"
    }
  }
}

# =============================================================================
# Variables
# =============================================================================
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# =============================================================================
# EKS Cluster
# =============================================================================
module "eks" {
  source = "../../modules/eks"

  cluster_name        = "uzavita-production"
  environment         = "production"
  aws_region          = var.aws_region
  vpc_cidr            = "10.1.0.0/16"
  kubernetes_version  = "1.30"

  # Production node group
  node_instance_types = ["m6i.2xlarge"]
  node_desired_size   = 5
  node_min_size       = 3
  node_max_size       = 20

  # GPU node group for ML workloads
  gpu_instance_types = ["g5.2xlarge"]
  gpu_desired_size   = 2
  gpu_min_size       = 1
  gpu_max_size       = 10

  tags = {
    CostCenter  = "production"
    Compliance  = "HIPAA"
    DataClass   = "PHI"
  }
}

# =============================================================================
# RDS PostgreSQL
# =============================================================================
module "rds" {
  source = "../../modules/rds"

  identifier         = "uzavita-prod"
  environment        = "production"
  vpc_id             = module.eks.vpc_id
  private_subnet_ids = module.eks.private_subnet_ids

  allowed_security_group_ids = [module.eks.cluster_security_group_id]

  # Production instance
  instance_class        = "db.r6g.2xlarge"
  allocated_storage     = 200
  max_allocated_storage = 1000
  engine_version        = "16.3"
  database_name         = "uzavita"
  master_username       = "uzavita_admin"

  # Multi-AZ for production HA
  multi_az = true

  # 30-day backup retention
  backup_retention_period = 30

  # Enable deletion protection
  deletion_protection = true

  # Enable Performance Insights
  performance_insights_enabled = true

  tags = {
    CostCenter = "production"
    Compliance = "HIPAA"
    DataClass  = "PHI"
    Backup     = "critical"
  }
}

# =============================================================================
# ElastiCache Redis
# =============================================================================
module "elasticache" {
  source = "../../modules/elasticache"

  cluster_id         = "uzavita-prod"
  environment        = "production"
  vpc_id             = module.eks.vpc_id
  private_subnet_ids = module.eks.private_subnet_ids

  allowed_security_group_ids = [module.eks.cluster_security_group_id]

  # Production instance
  node_type          = "cache.r6g.xlarge"
  num_cache_clusters = 3
  engine_version     = "7.1"

  # Full HA
  automatic_failover_enabled = true
  multi_az_enabled           = true

  # Full encryption
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  # 7-day snapshot retention
  snapshot_retention_limit = 7

  tags = {
    CostCenter = "production"
    Compliance = "HIPAA"
  }
}

# =============================================================================
# ECR Repositories
# =============================================================================
resource "aws_ecr_repository" "backend" {
  name                 = "uzavita/backend"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }
}

resource "aws_ecr_repository" "web" {
  name                 = "uzavita/web"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }
}

resource "aws_ecr_repository" "ml_service" {
  name                 = "uzavita/ml-service"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
  }
}

# Lifecycle policy for ECR - keep last 50 images in production
resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each   = toset(["uzavita/backend", "uzavita/web", "uzavita/ml-service"])
  repository = each.key

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 50 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 50
        }
        action = {
          type = "expire"
        }
      }
    ]
  })

  depends_on = [
    aws_ecr_repository.backend,
    aws_ecr_repository.web,
    aws_ecr_repository.ml_service,
  ]
}

# =============================================================================
# S3 Bucket for application data (PHI-compliant)
# =============================================================================
resource "aws_s3_bucket" "app_data" {
  bucket = "uzavita-production-data"

  tags = {
    DataClass  = "PHI"
    Compliance = "HIPAA"
  }
}

resource "aws_s3_bucket_versioning" "app_data" {
  bucket = aws_s3_bucket.app_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_logging" "app_data" {
  bucket = aws_s3_bucket.app_data.id

  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "s3-access-logs/app-data/"
}

resource "aws_s3_bucket" "access_logs" {
  bucket = "uzavita-production-access-logs"

  tags = {
    Purpose = "access-logging"
  }
}

resource "aws_s3_bucket_public_access_block" "access_logs" {
  bucket = aws_s3_bucket.access_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_kms_key" "s3" {
  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Purpose = "s3-encryption"
  }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/uzavita-prod-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# =============================================================================
# CloudWatch Log Group for application logs
# =============================================================================
resource "aws_cloudwatch_log_group" "application" {
  name              = "/uzavita/production"
  retention_in_days = 365
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Application = "uzavita"
    Compliance  = "HIPAA"
  }
}

resource "aws_kms_key" "cloudwatch" {
  description             = "KMS key for CloudWatch log encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM Policies"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      }
    ]
  })
}

data "aws_caller_identity" "current" {}

# =============================================================================
# WAF (Web Application Firewall)
# =============================================================================
resource "aws_wafv2_web_acl" "main" {
  name        = "uzavita-production-waf"
  description = "WAF for Uzavita production environment"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS Managed Rules - Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # Rate-based rule
  rule {
    name     = "RateLimit"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "UzavitaWAF"
    sampled_requests_enabled   = true
  }

  tags = {
    Compliance = "HIPAA"
  }
}

# =============================================================================
# Outputs
# =============================================================================
output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
}

output "rds_secret_arn" {
  description = "RDS credentials secret ARN"
  value       = module.rds.secret_arn
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = module.elasticache.primary_endpoint
}

output "redis_secret_arn" {
  description = "Redis auth token secret ARN"
  value       = module.elasticache.secret_arn
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.eks.vpc_id
}

output "s3_bucket" {
  description = "Application data S3 bucket"
  value       = aws_s3_bucket.app_data.id
}

output "waf_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.main.arn
}

output "ecr_backend_url" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_web_url" {
  description = "ECR repository URL for web"
  value       = aws_ecr_repository.web.repository_url
}

output "ecr_ml_service_url" {
  description = "ECR repository URL for ML service"
  value       = aws_ecr_repository.ml_service.repository_url
}
