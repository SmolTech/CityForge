FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    openssh-client \
    sshpass \
    git \
    curl \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Ansible and dependencies
RUN pip install --no-cache-dir \
    ansible>=8.0.0 \
    ansible-core>=2.15.0 \
    cryptography \
    paramiko \
    jinja2 \
    pyyaml \
    requests

# Create ansible user
RUN useradd -m -s /bin/bash ansible && \
    mkdir -p /home/ansible/.ssh && \
    chown -R ansible:ansible /home/ansible/.ssh && \
    chmod 700 /home/ansible/.ssh

# Create working directories
RUN mkdir -p /ansible/playbooks /ansible/inventory /ansible/roles /ansible/logs && \
    chown -R ansible:ansible /ansible

# Set working directory
WORKDIR /ansible

# Copy ansible configuration
COPY ansible/ansible.cfg /ansible/ansible.cfg
COPY ansible/*.yml /ansible/playbooks/
COPY ansible/group_vars/ /ansible/group_vars/
COPY ansible/templates/ /ansible/templates/
COPY ansible/inventory.ini /ansible/inventory/
COPY ansible/tunnel-manager.sh /ansible/

# Fix permissions
RUN chown -R ansible:ansible /ansible && \
    chmod +x /ansible/tunnel-manager.sh

# Switch to ansible user
USER ansible

# Create SSH config with proper settings
RUN echo "Host *" > /home/ansible/.ssh/config && \
    echo "    StrictHostKeyChecking no" >> /home/ansible/.ssh/config && \
    echo "    UserKnownHostsFile=/dev/null" >> /home/ansible/.ssh/config && \
    echo "    ControlMaster auto" >> /home/ansible/.ssh/config && \
    echo "    ControlPath /tmp/ssh-%r@%h:%p" >> /home/ansible/.ssh/config && \
    echo "    ControlPersist 60s" >> /home/ansible/.ssh/config && \
    chmod 600 /home/ansible/.ssh/config

# Set default command
CMD ["/bin/bash"]

# Labels
LABEL maintainer="CityForge Team" \
      description="Ansible runner for Cloudflare tunnel automation" \
      version="1.0.0"