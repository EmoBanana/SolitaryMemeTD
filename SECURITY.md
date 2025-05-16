# Security Guidelines for SolitaryMemeTD

## Handling Private Keys

This project requires a Solana private key for treasury operations. Follow these guidelines to maintain security:

### Setting up Environment Variables

1. **NEVER commit private keys to the Git repository**

   - The key files are listed in `.gitignore` to prevent accidental commits

2. **Use environment variables for local development:**

   - Create a `.env` file in the `frontend/backend` directory (this file is gitignored)
   - Add your key in the following format:
     ```
     TREASURY_SECRET_KEY="your_private_key_here"
     ```
   - Alternatively, set the environment variable directly in your terminal:
     - Windows: `set TREASURY_SECRET_KEY=your_private_key_here`
     - Linux/Mac: `export TREASURY_SECRET_KEY=your_private_key_here`

3. **For production deployments:**
   - Use your hosting platform's secure environment variable storage
   - For example, with Vercel, add the key in the project settings under "Environment Variables"
   - Never store keys in client-side code or public repositories

### Security Best Practices

1. **Never share your private key with anyone**
2. **Generate different keys for development and production environments**
3. **Regularly rotate keys, especially if you suspect they may have been compromised**
4. **Consider using a hardware wallet for production environments**
5. **Audit your Git history to ensure no sensitive information was previously committed**

By following these guidelines, you'll help maintain the security of the project and protect any funds associated with these keys.
