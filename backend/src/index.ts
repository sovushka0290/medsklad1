import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import medicationRoutes from './routes/medication.routes';
import transactionRoutes from './routes/transaction.routes';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Подключение новых роутов
app.use('/api', medicationRoutes);
app.use('/api', transactionRoutes);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'MedSklad API is running' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
