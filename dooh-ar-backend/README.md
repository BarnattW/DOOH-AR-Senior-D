# DOOH AR Backend - Geolocation Stats POC

This is a Next.js application that demonstrates accessing and displaying Geolocation API data.

## HTTPS Required

**This project requires HTTPS locally for Geolocation features.**

When you run this project for the first time, Next.js generates local SSL certificates. This often requires **Administrator privileges** on Windows.

### How to Run:
1.  **Right-click** your Terminal (or VS Code) and select **Run as Administrator**.
2.  Navigate to the project folder.
3.  Run:
    ```bash
    npm run dev
    ```
4.  If prompted, accept the certificate installation.

> **Troubleshooting:**
> If you see `Failed to generate self-signed certificate`, stop the server, switch to an Admin terminal, and try again.

---

## Getting Started

### 1. Prerequisites
- Node.js (v18 or newer)
- `npm`

### 2. Installation
```bash
npm install
```

### 3. Running the Development Server
```bash
npm run dev
```

Open [https://localhost:3000](https://localhost:3000) with your browser.

-   **Homepage**: Displays real-time Latitude, Longitude, Accuracy, Heading, and Speed.

> **Browser Warning**: You may see a "Not Secure" warning. Click **Advanced -> Proceed to localhost** to continue.

## Project Structure
- `src/app/page.tsx`: Main application logic (Geolocation and UI).
- `src/hooks/useGeolocation.ts`: Custom hook for accessing Geolocation API.
- `src/app/globals.css`: Basic global styles.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
