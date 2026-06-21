# Vercel Configuration Guide

For fast frontend deployments, use the following specifications:

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Environment Keys

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Make sure to enable `vercel.json` redirection to support React router navigation properly.
