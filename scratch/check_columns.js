const url = "https://ezmucovctccuyfkfdbvk.supabase.co/rest/v1/";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bXVjb3ZjdGNjdXlma2ZkYnZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNzAyNjUsImV4cCI6MjA5Nzc0NjI2NX0.GEYsVcTXJbvztr2-GlAHApTbk1GYAak_hNhIkZMVfAE";

fetch(url, {
  headers: {
    "apikey": anonKey,
    "Authorization": `Bearer ${anonKey}`
  }
})
.then(res => res.json())
.then(schema => {
  console.log("Full Schema Response:", schema);
})
.catch(err => console.error("Error fetching schema:", err));
