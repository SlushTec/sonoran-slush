terraform {
  required_version = ">= 1.10, < 2.0"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

module "environment_contract" {
  source                = "../../modules/environment-contract"
  environment           = "dev"
  aws_region            = var.aws_region
  live_commerce_enabled = false
}

output "scaffold_status" {
  value = module.environment_contract.contract
}
