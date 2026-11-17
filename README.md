# BongoPrompt

Prompt-driven travel planning and auto-budgeting for trips within Bangladesh.

Type (or say) something like *"I am in Dhaka and want to go to Cox's Bazar for 2 days with a 15000 taka budget"* and BongoPrompt builds the trip: transport options, hotels with live prices, a day-by-day itinerary, the weather forecast and a running budget.

## Features

- **Natural-language prompts** in English, Bangla or Banglish, plus voice input (English / বাংলা)
- **Transport**: real Bangladesh Railway timetables and fares, with estimated bus and flight options
- **Hotels**: live Agoda prices in BDT, shown on a map and sorted against your hotel budget
- **Itinerary**: morning / afternoon / evening plan and a local food pick for every day
- **Weather**: up to 16-day forecast for the destination with packing tips
- **Destination info**: photo and intro from Wikipedia
- **Budget bar** that tracks transport + hotel against your total
- **Trip pass** with QR code, downloadable as an image
- **Accounts**: sign up / log in, saved trips, local guide registration

## Tech stack

- Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript
- Groq (`openai/gpt-oss-120b` via the OpenAI SDK) for prompt parsing and itineraries
- Agoda via RapidAPI for hotels
- Open-Meteo for geocoding and weather (no key needed)
- Wikipedia REST API for destination info
- Leaflet for maps, `qrcode` + `html-to-image` for the trip pass
- SQLite through Node's built-in `node:sqlite` (no database server)

## Getting started

### Requirements

- Node.js 22.13 or newer (needed for `node:sqlite`)
- A [Groq](https://console.groq.com/) API key
- A [RapidAPI](https://rapidapi.com/) key subscribed to the **Agoda Travel** API

### Setup

```bash
git clone https://github.com/ekadaedalus/bongoprompt-ai.git
cd bongoprompt-ai
npm install
```

Create `.env.local` in the project root:

```env
GROQ_API_KEY=your_groq_key
RAPIDAPI_KEY=your_rapidapi_key
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database is created automatically at `data/bongoprompt.db` on first run and is git-ignored.

### Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start the dev server     |
| `npm run build` | Production build         |
| `npm start`     | Run the production build |
| `npm run lint`  | Lint with ESLint         |

## Voice input

"Speak your trip" uses the browser's Web Speech API:

- Works in Chrome, Edge and Safari. Not supported in Firefox; Brave and embedded browsers block the speech service.
- Needs HTTPS or `localhost`. To test on a phone over your network, use `next dev --experimental-https` or a tunnel such as ngrok.

## Project structure

```
app/
  page.tsx            Main planner UI
  components/         UI pieces (budget bar, hotel map, trip pass, mic button, ...)
  api/
    parse-prompt/     Planner endpoint (parses the prompt and streams the plan)
    auth/             Signup, login, logout, current user
    trips/            Saved trips
    guides/           Guide registration
lib/
  planner/            Groq, Agoda, railway, weather and Wikipedia integrations
  db.ts               SQLite schema and connection
  auth.ts, trips.ts   Accounts and saved trips
data/railway/         Bangladesh Railway timetable and fare snapshot
```

## Notes

- Bus and flight options, and the sample local guides, are AI-generated estimates, not live bookings.
- Hotel prices come from Agoda at search time and may change.

## Credits

Railway timetables and fares are from [Bangladesh-Railway-Train-and-Fare-List-with-Route-Map](https://github.com/ishohanul/Bangladesh-Railway-Train-and-Fare-List-with-Route-Map) (MIT License, © 2024 Nishat Mahmud). See [data/railway/LICENSE](data/railway/LICENSE).
