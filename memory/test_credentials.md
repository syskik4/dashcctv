# Test Credentials

## Application Login (JWT-based)
- **Admin User**
  - Email: `admin@sistema.com`
  - Password: `admin123`
  - Role: `admin`

## Database (Supabase Postgres Pooler)
- Connection string already configured in `/app/backend/.env` as `DATABASE_URL`.
- Host: `aws-0-us-west-2.pooler.supabase.com:6543`
- DB: `postgres`

## Backend URL
- Use the value of `REACT_APP_BACKEND_URL` from `/app/frontend/.env` for all API calls.
- All backend routes are prefixed with `/api`.
