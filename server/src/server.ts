import express from 'express';
import { supabase } from './db';

const app = express();
const port = 3000;

// Temporary test to verify Supabase connection
async function getStudents() {
  console.log('Attempting to fetch students from Supabase...');
  try {
    const { data, error } = await supabase.from('students').select('*');

    if (error) {
      console.error('Error fetching students:', error.message);
      return;
    }

    if (data) {
      console.log('Successfully connected to Supabase!');
      console.log('Students table contains:', data);
    } else {
      console.log('Successfully connected to Supabase, but the students table is empty.');
    }
  } catch (err) {
    console.error('An unexpected error occurred:', err);
  }
}

app.get('/', (req, res) => {
  res.send('Print Ledger Assistant Server is running!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  // Call the test function when the server starts
  getStudents();
});
