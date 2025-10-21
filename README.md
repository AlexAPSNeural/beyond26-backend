# Beyond26 Backend API

Node.js/Express backend for Beyond26 Investment Advisors website.

## 🚀 Deployment

This backend is designed to be deployed on **Render.com** (or similar Node.js hosting).

### Quick Deploy to Render.com

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial backend deployment"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Create Web Service on Render**
   - Go to https://render.com
   - New + → Web Service
   - Connect your GitHub repository
   - Configure:
     - **Name**: `beyond26-api`
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `node server.js`
     - **Plan**: Free (or paid for always-on)

3. **Add Environment Variables** (in Render Dashboard)
   ```
   PORT=10000
   NODE_ENV=production
   DB_HOST=<your-godaddy-mysql-host>
   DB_USER=<your-mysql-username>
   DB_PASSWORD=<your-mysql-password>
   DB_NAME=beyond26_db
   JWT_SECRET=<generate-random-string>
   CORS_ORIGIN=https://beyond26advisors.com

   # Email Configuration (GoDaddy SMTP)
   SMTP_HOST=beyond26advisors.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=website@beyond26advisors.com
   SMTP_PASS=Beyond262026
   EMAIL_FROM=website@beyond26advisors.com
   EMAIL_TO_EDGAR=esmith@beyond26advisors.com
   EMAIL_TO_ALEX=asmith@beyond26advisors.com
   ```

4. **Deploy!**
   - Render will automatically build and deploy
   - Your API will be live at: `https://your-service.onrender.com`

## 📋 Environment Variables

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
# Edit .env with your local MySQL credentials
```

Required variables:
- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment (development/production)
- `DB_HOST` - MySQL host
- `DB_USER` - MySQL username
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - Database name
- `JWT_SECRET` - Secret for JWT tokens
- `CORS_ORIGIN` - Allowed CORS origin
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP port (465 for SSL)
- `SMTP_SECURE` - Use SSL (true/false)
- `SMTP_USER` - Email account username
- `SMTP_PASS` - Email account password
- `EMAIL_FROM` - From email address
- `EMAIL_TO_EDGAR` - Edgar's email address
- `EMAIL_TO_ALEX` - Alex's email address

## 🔌 API Endpoints

### Health Check
```
GET /api/health
```

### Contact Form
```
POST /api/contact
Body: {
  name: string,
  firm: string,
  email: string,
  phone: string,
  comments: string
}
```

### Meeting Request
```
POST /api/meeting-request
Body: {
  advisor: string,
  name: string,
  email: string,
  phone: string,
  notes: string,
  selectedTimes: string[] // Array of selected time slots (up to 3)
}
```

**Note**: Both `/api/contact` and `/api/meeting-request` automatically send emails to Edgar and Alex using the GoDaddy SMTP credentials configured in environment variables.

## 💻 Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local MySQL credentials
   ```

3. **Run Server**
   ```bash
   node server.js
   ```

4. **Test Health Endpoint**
   ```bash
   curl http://localhost:4000/api/health
   ```

## 📦 Project Structure

```
server/
├── server.js              # Main entry point
├── package.json           # Dependencies
├── .env.example           # Environment template
├── src/
│   ├── routes.js          # API routes
│   ├── db.js              # Database connection
│   ├── controllers/       # Route controllers
│   └── middleware/        # Express middleware
├── scripts/               # Utility scripts
└── tests/                 # API tests
```

## 🔄 Updates

To update the deployed backend:

1. Make changes to code
2. Commit and push to GitHub
3. Render automatically redeploys (if connected)

## 🐛 Troubleshooting

### Database Connection Errors
- Verify MySQL credentials in environment variables
- Ensure GoDaddy MySQL allows external connections
- Check DB_HOST is correct (usually provided by GoDaddy)

### CORS Errors
- Verify CORS_ORIGIN matches your domain exactly
- Include `https://` in the URL
- No trailing slash

### Server Won't Start
- Check Render logs for specific errors
- Verify all environment variables are set
- Ensure package.json dependencies are correct

## 📚 Resources

- [Render Documentation](https://render.com/docs)
- [Express.js Docs](https://expressjs.com/)
- [MySQL2 Docs](https://github.com/sidorares/node-mysql2)
