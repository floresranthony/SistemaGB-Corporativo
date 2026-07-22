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
  const definition = schema.definitions && schema.definitions.vinculos_laborales;
  if (definition) {
    console.log("Columns in vinculos_laborales table definition:", Object.keys(definition.properties));
  } else {
    console.log("vinculos_laborales table definition not found. Available definitions:", Object.keys(schema.definitions || {}));
  }
})
.catch(err => console.error("Error fetching schema:", err));
