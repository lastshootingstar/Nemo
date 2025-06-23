NemoClinical Setup Instructions

Quick Start

1. **Extract the zip file**:
   bash
   unzip NemoClinical.zip
   cd NemoClinical
   

2. **Setup Backend** (Terminal 1):
   bash
   cd backend
   npm install
   npm start
   
   Backend will run on: http://localhost:7776

3. **Setup Frontend** (Terminal 2):
   bash
   cd frontend
   npm install
   npm start
   
   Frontend will run on: http://localhost:3000

4. **Access the Application**:
   Open your browser and go to: http://localhost:3000

Environment Setup

Before starting the backend, make sure to set up your DeepSeek API key:

1. Copy the environment file:
   bash
   cd backend
   cp .env.example .env
   

2. Edit `.env` and add your DeepSeek API key:
   
   DEEPSEEK_API_KEY="______________________________"
   PORT=7776
   

Testing the Application

1. Use the included `test_data.csv` file to test the upload functionality
2. Try asking questions like:
   - "What is the average age of patients?"
   - "Show me the distribution of treatment groups"
   - "Compare baseline scores between control and treatment groups"

Features

- Upload Excel/CSV files
- AI-powered data analysis with DeepSeek
- Interactive visualizations
- Statistical analysis tools
- Natural language queries

Troubleshooting

- Make sure both backend (port 7776) and frontend (port 3000) are running
- Check that your DeepSeek API key is correctly set in the .env file
- Ensure Node.js version 18+ is installed

