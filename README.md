# AI Mock Interview Platform 🎯

An AI-powered mock interview platform that helps candidates practice technical interviews, improve their answers, and receive AI-generated feedback.

## 🚀 Features

- **AI-Powered Interviews** – Generate interview questions using AI.
- **Interactive Practice** – Answer questions one at a time.
- **Instant Feedback** – Get feedback and suggestions to improve your answers.
- **Interview Scoring** – Receive a performance score and evaluation.
- **Interview History** – Review previous interview sessions and results.
- **Responsive UI** – Practice using desktop or mobile devices.
- **Secure Backend** – API-based communication between the frontend and backend.

## 🛠️ Tech Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend
- Node.js
- Express.js
- Groq API
- MongoDB

## 📁 Project Structure

```text
ai-assistant/
├── client/
│   ├── app/
│   ├── components/
│   ├── public/
│   └── package.json
├── server/
│   ├── src/
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```

*The structure above is representative; adjust it if your current repository differs.*

## ⚙️ Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/ASIM1304/ai-assistant.git
cd ai-assistant
```

### 2. Set up the frontend

```bash
cd client
npm install
```

Create a `.env.local` file inside the `client` folder if your frontend uses environment variables.

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

Frontend: `http://localhost:3000`

### 3. Set up the backend

Open another terminal:

```bash
cd server
npm install
```

Create a `.env` file inside the `server` folder and configure the required variables.

Example:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
GROQ_API_KEY=your_groq_api_key
```

Use the exact variable names expected by your backend code. Never commit real API keys or database credentials.

Start the backend using the script defined in `server/package.json`, commonly:

```bash
npm run dev
```

Backend: `http://localhost:5000`

## 🔑 Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | Backend server port |
| `MONGODB_URI` | MongoDB connection string |
| `GROQ_API_KEY` | API key for AI responses |
| `NEXT_PUBLIC_API_URL` | Backend API URL used by the frontend |

## 🧠 How It Works

1. The candidate opens the platform and starts a mock interview.
2. The backend generates interview questions using the AI service.
3. The candidate submits answers.
4. The AI evaluates the responses and provides feedback.
5. The platform records interview results and displays performance information.

## 🔒 Security

- Keep API keys and database credentials in environment files.
- Do not upload `.env` files to GitHub.
- Use `.env.example` with placeholder values for configuration guidance.
- Validate and authenticate API requests as required by the application.

## 🔮 Future Enhancements

- Resume-based interview questions
- Adaptive question difficulty
- Voice-based interviews
- Speech-to-text answer submission
- Detailed performance analytics
- Downloadable interview reports
- Additional programming languages and interview domains

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request.

## 📄 License

Add a license file if you intend to distribute the project under a specific open-source license.

---

**Developed as an AI-powered interview practice project.**

