variable "proxmox_api_url" {
  description = "The URL for the Proxmox API (e.g., https://192.168.15.125:8006/)"
  type        = string
  default     = "https://192.168.15.125:8006/"
}

variable "pm_token_id" {
  description = "The ID for the Proxmox API token"
  type        = string
}

variable "pm_token_secret" {
  description = "The secret for the Proxmox API token"
  type        = string
  sensitive   = true
}

variable "node_name" {
  description = "The Proxmox node to deploy to"
  type        = string
  default     = "danieldevops"
}

variable "vm_id" {
  description = "The ID of the VM"
  type        = number
  default     = 103
}

variable "vm_name" {
  description = "The name of the VM"
  type        = string
  default     = "vm-rota-mestra"
}

variable "template_id" {
  description = "The ID of the template to clone"
  type        = number
  default     = 9000
}

variable "ssh_public_key" {
  description = "The SSH public key to add to the VM"
  type        = string
  default     = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGIAr3O+SsfoQt9z7mW+XOj4Nu249LgEUhTEev0pqaTM daniel.rodrigues14@icloud.com"
}

variable "vm_password" {
  description = "Senha para o usuário ubuntu"
  type        = string
  sensitive   = true
}
