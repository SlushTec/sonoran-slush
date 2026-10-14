terraform {
  required_version = ">= 1.10, < 2.0"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Use a separate dev, staging or production environment."
  }
}

variable "aws_region" {
  type        = string
  description = "Configurable planning value only; account/model availability is not verified."
}

variable "live_commerce_enabled" {
  type    = bool
  default = false
  validation {
    condition     = var.live_commerce_enabled == false
    error_message = "Scaffold cannot enable live commerce. Complete and review production gates first."
  }
}

output "contract" {
  value = {
    project               = "sonoran-slush"
    environment           = var.environment
    proposed_region       = var.aws_region
    aws_resources_defined = false
    live_commerce_enabled = var.live_commerce_enabled
    architecture          = "amplify-ecs-fargate-managed-services"
  }
}
