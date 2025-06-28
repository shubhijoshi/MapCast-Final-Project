// 01 Initialize the map
const map = L.map("map").setView([20, 77], 5); // Default view: Center of India

// 02 Define light and dark tile layers
const lightTileLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png",
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }
);
const darkTileLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }
);
// Add the light tile layer to the map by default
lightTileLayer.addTo(map);

//03 Function to get weather emoji based on weather description
function getWeatherEmoji(weatherDescription) {
  const weatherEmojis = {
    clear: "☀️",clouds: "☁️",rain: "🌧️",thunderstorm: "⚡",snow: "❄️",mist: "🌫️",fog: "🌫️",
  };
  if (weatherDescription.includes("clear")) return weatherEmojis.clear;
  if (weatherDescription.includes("cloud")) return weatherEmojis.clouds;
  if (weatherDescription.includes("rain")) return weatherEmojis.rain;
  if (weatherDescription.includes("thunderstorm")) return weatherEmojis.thunderstorm;
  if (weatherDescription.includes("snow")) return weatherEmojis.snow;
  if (weatherDescription.includes("mist") || weatherDescription.includes("fog")) return weatherEmojis.mist;
  return "🌍";
}

//04 Fetch current weather data
async function fetchWeather(lat, lon) {
  const apiKey = "cadd09cea720b0cee953d8ae35fc9edd"; 
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Error fetching weather data:", error);
  }
}

//05 Fetch 5-day weather forecast
async function fetchForecast(lat, lon) {
  const apiKey = "cadd09cea720b0cee953d8ae35fc9edd"; 
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (error) {
    console.error("Error fetching forecast data:", error);
  }
}

//06 the boss function
//6.1 call weather and forecast function for lat, lon
async function handleWeatherAtLocation(lat, lon) {
  const weatherData = await fetchWeather(lat, lon);
  const forecastData = await fetchForecast(lat, lon);
  if (!weatherData || !forecastData) return;

  //6.2 reverse geocoding lat, long -> city, state, country
  const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
  const reverseData = await reverseRes.json();
  const city = reverseData.address.city || reverseData.address.town || reverseData.address.village || weatherData.name || "Unknown";
  const state = reverseData.address.state || "Unknown State";
  const country = reverseData.address.country || "Unknown Country";
  const weatherEmoji = getWeatherEmoji(weatherData.weather[0].description);

  //6.3 popup marker in map
  L.marker([lat, lon])
    .addTo(map)
    .bindPopup(`<b>Location:</b> ${city}, ${state}, ${country} ${weatherEmoji}`)
    .openPopup();

  //6.4 5day forecast 
  //6.4(a) Group by date
  const groupedByDay = forecastData.list.reduce((acc, entry) => {
    const date = new Date(entry.dt * 1000).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  //6.4(b) Extract midday forecasts
  const forecastDetails = Object.keys(groupedByDay)
    .slice(0, 5)
    .map((date) => {
      const dayEntries = groupedByDay[date];
      const middayForecast = dayEntries.reduce((closest, entry) => {
        const entryTime = new Date(entry.dt * 1000).getHours();
        return Math.abs(entryTime - 12) < Math.abs(new Date(closest.dt * 1000).getHours() - 12)
          ? entry
          : closest;
      });
      const temp = middayForecast.main.temp;
      const desc = middayForecast.weather[0].description;
      const emoji = getWeatherEmoji(desc);
      return `<b>${date}:</b> ${temp}°C, ${desc} ${emoji}`;
    })
    .join("<br>");

  //6.5 Info box update
  const weatherInfo = `
    <b>Location:</b> ${city}, ${state}, ${country} ${weatherEmoji}<br>
    <b>Temperature:</b> ${weatherData.main.temp}°C<br>
    <b>Weather:</b> ${weatherData.weather[0].description}<br>
    <b>Humidity:</b> ${weatherData.main.humidity}%<br>
    <b>Wind Speed:</b> ${weatherData.wind.speed} m/s<br>
    <b>Pressure:</b> ${weatherData.main.pressure} hPa<br>
    <b>Sunrise:</b> ${new Date(weatherData.sys.sunrise * 1000).toLocaleTimeString()}<br> 
    <b>Sunset:</b> ${new Date(weatherData.sys.sunset * 1000).toLocaleTimeString()}<br>
    <hr>
    <b>5-Day Forecast (around midday):</b><br>${forecastDetails}
  `;
  document.getElementById("info").innerHTML = weatherInfo;
}

//07 search functionality
document.getElementById("search-btn").addEventListener("click", async function () {
  const searchQuery = document.getElementById("place").value;
  if (!searchQuery) return alert("Please enter a place name to search.");
  const apiKey = "cadd09cea720b0cee953d8ae35fc9edd";
  const geocodingUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${searchQuery}&limit=1&appid=${apiKey}`;

  try {
    const response = await fetch(geocodingUrl);
    const geocodingData = await response.json();

    if (geocodingData.length > 0) {
      const { lat, lon } = geocodingData[0];
      map.setView([lat, lon], 10);
      handleWeatherAtLocation(lat, lon);
    } else {
      alert("Location not found. Please try again.");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred while searching. Please try again.");
  }
});

//08 handling map clicks
map.on("click", function (e) {
  const { lat, lng } = e.latlng;
  handleWeatherAtLocation(lat, lng);
});

//09 light and dark themes
const themeToggle = document.getElementById("themeToggle");
const toggleLabel = document.getElementById("toggleLabel");
const infoBox = document.getElementById("info");

themeToggle.addEventListener("change", function () {
  if (themeToggle.checked) {
    map.removeLayer(lightTileLayer);
    darkTileLayer.addTo(map);
    toggleLabel.textContent = "Dark Mode";
    document.body.classList.add("dark-mode");
    infoBox.classList.add("dark-mode");
  } else {
    map.removeLayer(darkTileLayer);
    lightTileLayer.addTo(map);
    toggleLabel.textContent = "Light Mode";
    document.body.classList.remove("dark-mode");
    infoBox.classList.remove("dark-mode");
  }
});
