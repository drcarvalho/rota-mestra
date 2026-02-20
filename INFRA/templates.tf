resource "proxmox_virtual_environment_file" "ubuntu_cloud_image" {
  content_type = "iso"
  datastore_id = "local"
  node_name    = var.node_name

  source_file {
    path = "https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img"
    file_name = "ubuntu-22.04-server-cloudimg-amd64.img"
  }
}

resource "proxmox_virtual_environment_file" "cloud_config" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = var.node_name

  source_raw {
    data = templatefile("${path.module}/cloud-config.yaml", {
      vm_password    = var.vm_password
      ssh_public_key = var.ssh_public_key
    })
    file_name = "cloud-config-ubuntu.yaml"
  }
}

resource "proxmox_virtual_environment_vm" "ubuntu_template" {
  name        = "ubuntu-22-04-template"
  node_name   = var.node_name
  vm_id       = var.template_id
  template    = true

  cpu {
    cores = 4
    type  = "host"
  }


  memory {
    dedicated = 1024
  }

  disk {
    datastore_id = "local-lvm"
    file_id      = proxmox_virtual_environment_file.ubuntu_cloud_image.id
    interface    = "scsi0"
    size         = 10
  }

  network_device {
    bridge = "vmbr0"
  }

  initialization {
    datastore_id = "local-lvm"
    interface    = "ide2"
    user_data_file_id = proxmox_virtual_environment_file.cloud_config.id

    user_account {
      keys     = [var.ssh_public_key]
      username = "ubuntu"
      password = var.vm_password
    }
    
    ip_config {
      ipv4 {
        address = "dhcp"
      }
    }
  }
}
