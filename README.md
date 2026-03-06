# LecRate Telegram Bot - Project Status & Documentation

_Last Updated: March 6, 2026_

## Overview

This file documents the current state of the LecRate Telegram Bot (`lecrate-bot`) to ensure all progress and configurations are saved securely within the project repository.

The bot is designed to be a Telegram interface for the LecRate web application, connecting to the exact same Supabase database.

## Architecture

- **Framework:** `telegraf` (v4.16.3)
- **Database:** Supabase (PostgreSQL) - Shares the same `sources`, `lectures`, `batches`, `modules`, and `ratings` tables as the Next.js web app.
- **Session Management:** `telegraf-session-local`
- **Hosting:** Netlify Serverless Functions (Webhook mode)

## Deployment Details (Netlify)

The bot is deployed as a Serverless Function on Netlify to run 100% free with no sleep delays.

- **Base Directory:** `(empty)`
- **Build Command:** `npm install`
- **Publish Directory:** `(empty)`
- **Functions Directory:** `netlify/functions`
- **Webhook URL:** `https://superlative-conkies-55e617.netlify.app/.netlify/functions/bot`

### Environment Variables (.env)

- `BOT_TOKEN`: The token from Telegram @BotFather.
- `SUPABASE_URL`: The project URL from Supabase.
- `SUPABASE_ANON_KEY`: The public anon key from Supabase.
- `NODE_ENV`: `production` (To ensure the webhook handler runs, not the local polling `bot.launch()`).

## Key Features Implemented

1. **Browsing:** Users can navigate through Batches -> Modules -> Lectures/Sections to view sources ordered by rating.
2. **Scenes Structure:** Uses Telegraf Scenes (`RATE_SCENE`, `ADD_SOURCE_SCENE`, `ADD_URL_SCENE`) for step-by-step user input (Name -> Rating -> Comment -> URL).
3. **Rating System:**
   - Users can rate sources from 1 to 10.
   - Duplicate rating prevention is implemented checking `user_identifier` (Telegram user ID) against the Supabase `ratings` table.
4. **Contributions:** Users can add new sources or attach missing URLs to existing sources.
5. **Performance Optimizations:**
   - `ctx.answerCbQuery()` is called instantly on button presses (like "Rate") to remove the Telegram loading spinner immediately before performing database queries.
   - Local sessions are saved to `/tmp/session_db.json` to comply with Netlify's read-only serverless environment.

## Git Workflow

The bot has its own dedicated GitHub repository (`lecrate-bot`).

- `main` branch: Connected to Netlify for automatic production deployments.
- `development` branch: Used for testing new features or local testing before merging to `main`.
