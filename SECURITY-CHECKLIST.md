# Security Checklist - Epic Pizza & Pasta

Use this checklist before any deployment to ensure security best practices are followed.

## 🔒 Environment & Configuration

- [ ] No actual `.env` files are committed to version control
- [ ] All `.env.example` files use placeholder values only
- [ ] Database credentials are stored in `docker-compose.env` (not in docker-compose.yml)
- [ ] `docker-compose.env` is excluded from version control (.gitignore)
- [ ] Production environment variables are injected at runtime, not baked into images

## 🐳 Docker Security

- [ ] Dockerfile does not copy `.env` files into production images
- [ ] Docker Compose uses environment variable substitution for credentials
- [ ] Production images use proper secret management
- [ ] Base images are from trusted sources and up-to-date

## 🔑 Secrets Management

- [ ] JWT private/public keys are generated securely and not hardcoded
- [ ] Database passwords use strong, randomly generated values
- [ ] API keys (Google Maps, SMTP, etc.) are kept in environment variables only
- [ ] Webhook secrets are randomly generated and secure

## 🌐 Network Security

- [ ] CORS origins are properly configured for production domains
- [ ] Rate limiting is enabled and configured appropriately
- [ ] CSRF protection is enabled and working
- [ ] HTTPS is enforced in production

## 📊 Database Security

- [ ] Database uses strong authentication credentials
- [ ] Database network access is restricted to necessary services only
- [ ] Database backups are encrypted and secure
- [ ] Migrations don't contain sensitive data

## 🔍 Code Security

- [ ] No hardcoded credentials in source code
- [ ] No sensitive information in comments
- [ ] Dependencies are regularly updated for security patches
- [ ] Input validation is properly implemented

## 📋 Deployment Security

- [ ] Production builds exclude development dependencies
- [ ] Log files don't contain sensitive information
- [ ] Error messages don't expose system internals
- [ ] Health check endpoints don't expose sensitive data

## 🚨 Incident Response

- [ ] Know how to rotate compromised credentials
- [ ] Have a plan for security incident response
- [ ] Regular security audits are scheduled
- [ ] Security contact information is documented

## ✅ Verification Commands

```bash
# Check for accidentally committed sensitive files
find . -name ".env" -not -path "*/node_modules/*" | grep -v ".env.example"

# Verify no hardcoded secrets in code
grep -r -i "password\|secret\|key.*=" --include="*.ts" --include="*.js" . | grep -v ".env.example" | grep -v "node_modules"

# Check Docker Compose config
docker compose config

# Verify .gitignore excludes sensitive files
grep -E "(\.env|docker-compose\.env)" .gitignore
```

## 📞 Security Contacts

- **Development Team**: Update with actual contact information
- **Security Team**: Update with actual contact information
- **Emergency Contact**: Update with actual contact information

---
**Last Updated**: December 2024  
**Next Review**: Update as needed