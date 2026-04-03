# Inventrix Deployment Info

- Instance ID: i-07f3939991cac223b
- Region: us-west-2
- Public IP: 52.88.231.119
- Application URL: https://52.88.231.119 (self-signed certificate)
- SSH Command: ssh -i inventrix-key.pem ec2-user@52.88.231.119

## Default Credentials

- Admin: admin@inventrix.com / admin123
- Customer: customer@inventrix.com / customer123

## Notes

- Browser will show a security warning due to the self-signed certificate
- Security group rules are scoped to deployer's IP (46.248.159.10/32)
- To terminate: `aws ec2 terminate-instances --region us-west-2 --instance-ids i-07f3939991cac223b`

## Upon Restart

Check the following before accessing the app:

- EC2 instance public IP (changes after stop/start unless Elastic IP is attached) — update this file with the new IP
- PC's assigned IP (check at https://ifconfig.me) — if your IP changed, update the security group ingress rules to allow your new IP
