resource "proxmox_virtual_environment_vm" "rota_mestra" {
  name        = "vm-rota-leves"
  node_name   = var.node_name
  vm_id       = 111

  agent {
    enabled = false
  }

  clone {
    vm_id = proxmox_virtual_environment_vm.ubuntu_template.vm_id
    full  = true
  }

  cpu {
    cores = 4
    type  = "host"
  }


  memory {
    dedicated = 4096
  }

  disk {
    datastore_id = "local-lvm"
    file_format  = "raw"
    interface    = "scsi0"
    size         = 20
  }

  network_device {
    bridge = "vmbr0"
  }

  initialization {
    datastore_id = "local-lvm"
    user_data_file_id = proxmox_virtual_environment_file.cloud_config.id

    user_account {
      keys     = [var.ssh_public_key]
      username = "ubuntu"
      password = var.vm_password
    }

    ip_config {
      ipv4 {
        address = "192.168.15.111/24"
        gateway = "192.168.15.1"
      }
    }
  }
}
