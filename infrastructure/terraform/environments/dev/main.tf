###############################################################################
# Aura Health - Dev Environment
# Small instance sizes for development and testing
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
    bucket         = "aura-health-terraform-state"
    key            = "environments/dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "aura-health-terraform-locks"
  }
}

# =============================================================================
# Provider
# =============================================================================
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "aura-health"
      Environment = "dev"
      ManagedBy   = "terraform"
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

  cluster_name        = "aura-health-dev"
  environment         = "dev"
  aws_region          = var.aws_region
  vpc_cidr            = "10.0.0.0/16"
  kubernetes_version  = "1.30"

  # Small node group for dev
  node_instance_types = ["t3.large"]
  node_desired_size   = 2
  node_min_size       = 1
  node_max_size       = 4

  # Single small GPU node (or none)
  gpu_instance_types = ["g5.xlarge"]
  gpu_desired_size   = 0
  gpu_min_size       = 0
  gpu_max_size       = 1

  tags = {
    CostCenter = "development"
  }
}

# =============================================================================
# RDS PostgreSQL
# =============================================================================
module "rds" {
  source = "../../modules/rds"

  identifier         = "aura-health-dev"
  environment        = "dev"
  vpc_id             = module.eks.vpc_id
  private_subnet_ids = module.eks.private_subnet_ids

  allowed_security_group_ids = [module.eks.cluster_security_group_id]

  # Smaller instance for dev
  instance_class        = "db.t3.large"
  allocated_storage     = 20
  max_allocated_storage = 50
  engine_version        = "16.3"
  database_name         = "aura_health"
  master_username       = "aura_admin"

  # Single-AZ for dev (cost savings)
  multi_az = false

  # Shorter backup retention
  backup_retention_period = 7

  # Allow deletion in dev
  deletion_protection = false

  # Disable Performance Insights in dev
  performance_insights_enabled = false

  tags = {
    CostCenter = "development"
  }
}

# =============================================================================
# ElastiCache Redis
# =============================================================================
module "elasticache" {
  source = "../../modules/elasticache"

  cluster_id         = "aura-health-dev"
  environment        = "dev"
  vpc_id             = module.eks.vpc_id
  private_subnet_ids = module.eks.private_subnet_ids

  allowed_security_group_ids = [module.eks.cluster_security_group_id]

  # Smaller instance for dev
  node_type          = "cache.t3.medium"
  num_cache_clusters = 1
  engine_version     = "7.1"

  # Single node, no HA for dev
  automatic_failover_enabled = false
  multi_az_enabled           = false

  # Shorter snapshot retention
  snapshot_retention_limit = 1

  # Disable transit encryption for dev simplicity
  transit_encryption_enabled = false

  tags = {
    CostCenter = "development"
  }
}

# =============================================================================
# ECR Repositories
# =============================================================================
resource "aws_ecr_repository" "backend" {
  name                 = "aura-health/backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_repository" "web" {
  name                 = "aura-health/web"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_repository" "ml_service" {
  name                 = "aura-health/ml-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Lifecycle policy for ECR - keep only last 10 images
resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each   = toset(["aura-health/backend", "aura-health/web", "aura-health/ml-service"])
  repository = each.key

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
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

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = module.elasticache.primary_endpoint
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.eks.vpc_id
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
