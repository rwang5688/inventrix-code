#!/bin/bash
set -e

echo "=== Inventrix AWS Deployment Script (Temporary Credentials) ==="
echo ""

# Validate temporary credentials from command line
if [[ -z "$AWS_ACCESS_KEY_ID" || -z "$AWS_SECRET_ACCESS_KEY" || -z "$AWS_SESSION_TOKEN" ]]; then
  echo "Usage: AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> AWS_SESSION_TOKEN=<token> $0"
  echo ""
  echo "You must export temporary credentials before running this script:"
  echo "  export AWS_ACCESS_KEY_ID=ASIA..."
  echo "  export AWS_SECRET_ACCESS_KEY=..."
  echo "  export AWS_SESSION_TOKEN=..."
  echo ""
  exit 1
fi

echo "Using temporary credentials (AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:0:8}...)"
echo ""

# Prompt for configuration
read -p "AWS Region [us-west-2]: " AWS_REGION
AWS_REGION="${AWS_REGION:-us-west-2}"

AWS_OPTS="--region $AWS_REGION"

read -p "Instance Type [t3.small]: " INSTANCE_TYPE
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.small}"

read -p "Key Pair Name [inventrix-key]: " KEY_NAME
KEY_NAME="${KEY_NAME:-inventrix-key}"

read -p "Security Group Name [inventrix-sg]: " SECURITY_GROUP_NAME
SECURITY_GROUP_NAME="${SECURITY_GROUP_NAME:-inventrix-sg}"

read -p "Instance Name [inventrix-server]: " INSTANCE_NAME
INSTANCE_NAME="${INSTANCE_NAME:-inventrix-server}"

AMI_ID="resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"

# Display configuration
echo ""
echo "=== Deployment Configuration ==="
echo "AWS Credentials:     Temporary (env vars)"
echo "AWS Region:          $AWS_REGION"
echo "Instance Type:       $INSTANCE_TYPE"
echo "Key Pair Name:       $KEY_NAME"
echo "Security Group:      $SECURITY_GROUP_NAME"
echo "Instance Name:       $INSTANCE_NAME"
echo "AMI:                 Amazon Linux 2023 (latest)"
echo ""

# Confirm
read -p "Proceed with deployment? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Deployment cancelled."
  exit 0
fi

echo ""

# Create security group
echo "Creating security group..."
if aws ec2 describe-security-groups $AWS_OPTS --group-names $SECURITY_GROUP_NAME &>/dev/null; then
  SG_ID=$(aws ec2 describe-security-groups $AWS_OPTS --group-names $SECURITY_GROUP_NAME --query 'SecurityGroups[0].GroupId' --output text)
  echo "Using existing security group: $SG_ID"
else
  SG_ID=$(aws ec2 create-security-group $AWS_OPTS \
    --group-name $SECURITY_GROUP_NAME \
    --description "Security group for Inventrix application" \
    --query 'GroupId' --output text)
  echo "Created security group: $SG_ID"
fi

# Get user's external IP for security group rules
echo "Detecting your external IP address..."
MY_IP=$(curl -s https://checkip.amazonaws.com | tr -d '[:space:]')
if [[ -z "$MY_IP" ]]; then
  echo "ERROR: Could not detect external IP address. Check your internet connection."
  exit 1
fi
echo "External IP: $MY_IP"

# Add security group rules scoped to user's IP
echo "Configuring security group rules..."
aws ec2 authorize-security-group-ingress $AWS_OPTS --group-id $SG_ID --protocol tcp --port 22 --cidr ${MY_IP}/32 &>/dev/null || true
aws ec2 authorize-security-group-ingress $AWS_OPTS --group-id $SG_ID --protocol tcp --port 80 --cidr ${MY_IP}/32 &>/dev/null || true
aws ec2 authorize-security-group-ingress $AWS_OPTS --group-id $SG_ID --protocol tcp --port 443 --cidr ${MY_IP}/32 &>/dev/null || true
aws ec2 authorize-security-group-ingress $AWS_OPTS --group-id $SG_ID --protocol tcp --port 3000 --cidr ${MY_IP}/32 &>/dev/null || true
echo "Security group rules configured (restricted to $MY_IP/32)."

# Create key pair if it doesn't exist
if aws ec2 describe-key-pairs $AWS_OPTS --key-names $KEY_NAME &>/dev/null; then
  if [ ! -f "${KEY_NAME}.pem" ]; then
    echo "ERROR: Key pair '$KEY_NAME' exists in AWS but ${KEY_NAME}.pem not found locally."
    echo "Please provide the key file or delete the key pair in AWS and re-run."
    exit 1
  fi
  echo "Using existing key pair: $KEY_NAME"
else
  echo "Creating key pair..."
  aws ec2 create-key-pair $AWS_OPTS --key-name $KEY_NAME --query 'KeyMaterial' --output text > ${KEY_NAME}.pem
  chmod 400 ${KEY_NAME}.pem
  echo "Key pair saved to ${KEY_NAME}.pem"
fi

# User data script - base64 encode to avoid GitBash path/line-ending issues
USER_DATA_B64=$(printf '#!/bin/bash\nyum update -y\nyum groupinstall -y "Development Tools"\ncurl -fsSL https://rpm.nodesource.com/setup_22.x | bash -\nyum install -y nodejs git nginx\nnpm install -g pnpm pm2\nsystemctl enable nginx\n' | base64 -w 0)

# Launch EC2 instance
echo "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances $AWS_OPTS \
  --image-id $AMI_ID \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_NAME \
  --security-group-ids $SG_ID \
  --user-data "$USER_DATA_B64" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
  --query 'Instances[0].InstanceId' --output text)

echo "Instance ID: $INSTANCE_ID"
echo "Waiting for instance to be running..."
aws ec2 wait instance-running $AWS_OPTS --instance-ids $INSTANCE_ID

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances $AWS_OPTS --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
echo "Instance Public IP: $PUBLIC_IP"

echo "Waiting for instance initialization..."
echo "Checking if setup is complete..."
for i in {1..30}; do
  if ssh -i ${KEY_NAME}.pem -o StrictHostKeyChecking=no -o ConnectTimeout=10 ec2-user@$PUBLIC_IP "command -v pnpm >/dev/null 2>&1 && command -v pm2 >/dev/null 2>&1" 2>/dev/null; then
    echo "Instance ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "ERROR: Instance initialization timed out. Check user-data logs with:"
    echo "  ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP 'sudo cat /var/log/cloud-init-output.log'"
    exit 1
  fi
  echo "Still initializing... ($i/30)"
  sleep 20
done

# Upload application code
echo "Uploading application code..."
cd "$(dirname "$0")"
tar czf /tmp/inventrix.tar.gz --exclude=node_modules --exclude=dist --exclude=.git --exclude=inventrix.db .
scp -i ${KEY_NAME}.pem -o StrictHostKeyChecking=no /tmp/inventrix.tar.gz ec2-user@$PUBLIC_IP:~/
rm /tmp/inventrix.tar.gz

# Deploy application
echo "Deploying application..."
ssh -i ${KEY_NAME}.pem -o StrictHostKeyChecking=no ec2-user@$PUBLIC_IP << 'ENDSSH'
cd ~
tar xzf inventrix.tar.gz
rm inventrix.tar.gz
pnpm install
pnpm build
cd packages/api
pm2 start dist/index.js --name inventrix-api
pm2 save
pm2 startup | tail -1 | bash
ENDSSH

# Configure nginx with HTTPS
echo "Configuring nginx with HTTPS..."
ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP << 'ENDSSH'
# Allow nginx to access ec2-user home directory for serving static files
chmod 711 /home/ec2-user
sudo mkdir -p /etc/nginx/conf.d /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/inventrix.key \
  -out /etc/nginx/ssl/inventrix.crt \
  -subj "/C=US/ST=State/L=City/O=Inventrix/CN=inventrix"
sudo tee /etc/nginx/conf.d/inventrix.conf > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name _;
    ssl_certificate /etc/nginx/ssl/inventrix.crt;
    ssl_certificate_key /etc/nginx/ssl/inventrix.key;
    location / {
        root /home/ec2-user/packages/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
    location /images {
        proxy_pass http://localhost:3000;
    }
}
NGINX
sudo systemctl restart nginx
ENDSSH

echo ""
echo "=== Deployment Complete ==="
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "Application URL: https://$PUBLIC_IP (self-signed certificate)"
echo "SSH Command: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP"
echo ""
echo "Note: Your browser will show a security warning due to the self-signed certificate."
echo ""
echo "Default credentials:"
echo "  Admin: admin@inventrix.com / admin123"
echo "  Customer: customer@inventrix.com / customer123"
