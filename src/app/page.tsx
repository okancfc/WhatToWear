"use client";

import { useEffect, useState, useRef } from "react";
import { RefreshCw, Search, X, Droplets, Wind, Thermometer, ChevronLeft, ChevronRight, Clock, Calendar } from "lucide-react";

// Hava durumu veri tipleri
type WeatherData = {
  name: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  sys: {
    sunset: number;
    sunrise: number;
  };
};

type HourlyForecast = {
  dt: number;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  dt_txt: string;
};

type DailyForecast = {
  dt: number;
  sunrise: number;
  sunset: number;
  temp: {
    day: number;
    min: number;
    max: number;
  };
  feels_like: {
    day: number;
  };
  humidity: number;
  weather: Array<{
    description: string;
    icon: string;
  }>;
  wind_speed: number;
};

export default function Home() {
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecast[]>([]);
  const [dailyForecast, setDailyForecast] = useState<DailyForecast[]>([]);
  const [error, setError] = useState("");
  const [activeDay, setActiveDay] = useState(0);
  const [showDailyView, setShowDailyView] = useState(true);

  const cardsRef = useRef<HTMLDivElement>(null);

  // Geolocation ile ilk yüklemede hava durumu alınır.
  useEffect(() => {
    const getLocation = async () => {
      setLoading(true);
      try {
        if ("geolocation" in navigator) {
          const positionPromise = new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (position) => resolve(position),
              () => reject(new Error("Konum erişimi reddedildi veya mevcut değil")),
              { timeout: 10000, enableHighAccuracy: false }
            );
          });

          try {
            const position = await positionPromise;
            const { latitude, longitude } = position.coords;
            await getWeatherAndForecastByCoordinates(latitude, longitude);
          } catch (err) {
            console.log("Konum alınamadı, varsayılan şehir kullanılacak");
            setCity("İstanbul");
            await handleCitySearch("İstanbul");
          }
        } else {
          console.log("Konum erişimi desteklenmiyor, varsayılan şehir kullanılacak");
          setCity("İstanbul");
          await handleCitySearch("İstanbul");
        }
      } catch (error) {
        setError("Bir hata oluştu, lütfen manuel olarak şehir arayın");
      } finally {
        setLoading(false);
      }
    };

    getLocation();
  }, []);

  // Geolocation ile alınan koordinatlar için; mevcut hava durumu ve tahmin bilgilerini getirir.
  const getWeatherAndForecastByCoordinates = async (lat: number, lon: number) => {
    setLoading(true);
    setError("");
    try {
      const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
      if (!apiKey) throw new Error("API anahtarı bulunamadı");

      const weatherResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=tr&appid=${apiKey}`
      );
      if (!weatherResponse.ok) throw new Error(`API yanıt hatası: ${weatherResponse.status}`);
      const weatherData = await weatherResponse.json();
      setWeather(weatherData);
      setCity(weatherData.name);

      await getForecastByCoordinates(lat, lon);
    } catch (error) {
      console.error("Hava durumu API hatası:", error);
      setError("Hava durumu verisi alınamadı. Lütfen manuel olarak şehir arayın.");
    } finally {
      setLoading(false);
    }
  };

  // Koordinatlar üzerinden 5 günlük/3 saatlik tahmin verilerini getirir ve gruplandırır.
  const getForecastByCoordinates = async (lat: number, lon: number) => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
      if (!apiKey) throw new Error("API anahtarı bulunamadı");

      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=tr&appid=${apiKey}`
      );
      if (!forecastResponse.ok) throw new Error(`Forecast API yanıt hatası: ${forecastResponse.status}`);
      const forecastData = await forecastResponse.json();

      // Saatlik verileri sakla
      setHourlyForecast(forecastData.list);

      // Günlük tahminleri gruplandır
      const groupForecastByDay = (list: HourlyForecast[]): DailyForecast[] => {
        const grouped: { [date: string]: HourlyForecast[] } = {};
        list.forEach((item) => {
          const date = new Date(item.dt_txt).toISOString().split("T")[0];
          if (!grouped[date]) grouped[date] = [];
          grouped[date].push(item);
        });
        return Object.entries(grouped).map(([dateStr, items]) => {
          const dt = Math.floor(new Date(dateStr).getTime() / 1000);
          const temps = items.map((i) => i.main.temp);
          const feels = items.map((i) => i.main.feels_like);
          const humidities = items.map((i) => i.main.humidity);
          const winds = items.map((i) => i.wind.speed);
          return {
            dt,
            sunrise: 0,
            sunset: 0,
            temp: {
              day: average(temps),
              min: Math.min(...temps),
              max: Math.max(...temps),
            },
            feels_like: {
              day: average(feels),
            },
            humidity: average(humidities),
            wind_speed: average(winds),
            weather: [items[0].weather[0]],
          };
        });
      };

      const average = (arr: number[]) =>
        Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

      const groupedForecast = groupForecastByDay(forecastData.list);
      setDailyForecast(groupedForecast);
      setActiveDay(0);
    } catch (error) {
      console.error("Tahmin verisi alınamadı:", error);
    }
  };

  // Manuel aramalarda, doğrudan "q" parametresi ile arama yapılır.
  const handleCitySearch = async (cityName: string) => {
    if (!cityName.trim()) return;

    setLoading(true);
    setError("");
    try {
      const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
      if (!apiKey) throw new Error("API anahtarı bulunamadı");

      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&units=metric&lang=tr&appid=${apiKey}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError("Şehir bulunamadı. Lütfen başka bir şehir adı girin.");
        } else {
          throw new Error(`API yanıt hatası: ${response.status}`);
        }
        setWeather(null);
        return;
      }

      const data = await response.json();
      if (data.cod === 200) {
        setWeather(data);
        setCity(data.name);
        await getForecastByCoordinates(data.coord.lat, data.coord.lon);
      } else {
        setError(`Hava durumu verisi alınamadı: ${data.message || 'Bilinmeyen hata'}`);
        setWeather(null);
      }
    } catch (error) {
      console.error("Şehir arama hatası:", error);
      setError("Veri alınamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleCitySearch(city);
  };

  const getClothingAdvice = (temp: number) => {
    if (temp >= 30) return "Çok sıcak! İnce ve açık renkli giysiler giyin.";
    if (temp >= 20) return "Ilık bir hava, tişört ve hafif ceket yeterli olur.";
    if (temp >= 10) return "Serin hava, kazak veya mont tercih edin.";
    if (temp >= 0) return "Soğuk! Kalın ceket, atkı ve bere önerilir.";
    return "Dondurucu soğuk! Kat kat giyinin ve mümkünse dışarı çıkmayın.";
  };

  const getBackgroundClass = () => {
    if (!weather) return "from-blue-400 to-blue-600";
  
    const now = Math.floor(new Date().getTime() / 1000);
    const { sunrise, sunset } = weather.sys;
  
    // Gündüz olup olmadığını kontrol et: şimdi > güneşin doğuşu && şimdi < güneşin batışı
    const isDay = sunrise && sunset ? now >= sunrise && now < sunset : true;
  
    const temp = weather.main.temp;
  
    if (isDay) {
      if (temp >= 25) return "from-orange-400 to-orange-600";     // sıcak
      if (temp >= 15) return "from-blue-400 to-blue-500";          // ılık
      if (temp >= 5)  return "from-blue-300 to-blue-400";          // serin
      return "from-blue-200 to-blue-300";                          // soğuk
    } else {
      if (temp >= 20) return "from-purple-800 to-purple-900";      // sıcak gece
      if (temp >= 10) return "from-blue-850 to-blue-950";          // ılık/serin gece
      return "from-indigo-900 to-blue-950";                        // soğuk gece
    }
  };
  
  

  const getWeatherIcon = (iconCode?: string) => {
    if (!iconCode) {
      if (weather && weather.weather && weather.weather[0] && weather.weather[0].icon) {
        iconCode = weather.weather[0].icon;
      } else {
        return "https://openweathermap.org/img/wn/10d@4x.png";
      }
    }
    return `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
  };

  const formatDate = (timestamp: number, format: 'day' | 'hour' | 'full' = 'full') => {
    const date = new Date(timestamp * 1000);
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    if (format === 'day') return days[date.getDay()];
    else if (format === 'hour') return `${date.getHours()}:00`;
    else return `${date.getDate()} ${months[date.getMonth()]} ${days[date.getDay()]}`;
  };

  const scrollCards = (direction: 'left' | 'right') => {
    if (cardsRef.current) {
      const scrollAmount = 300;
      if (direction === 'left') cardsRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      else cardsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const changeActiveDay = (index: number) => {
    setActiveDay(index);
    if (cardsRef.current) {
      const cards = cardsRef.current.children;
      if (cards[index]) cardsRef.current.scrollLeft = (cards[index] as HTMLElement).offsetLeft - 20;
    }
  };

  const getHourlyForecastForActiveDay = () => {
    if (hourlyForecast.length === 0) return [];
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + activeDay);
    return hourlyForecast.filter(item => {
      const itemDate = new Date(item.dt * 1000);
      return itemDate.getDate() === targetDate.getDate() &&
             itemDate.getMonth() === targetDate.getMonth() &&
             itemDate.getFullYear() === targetDate.getFullYear();
    });
  };

  return (
    <div className={`min-h-screen w-full bg-gradient-to-b ${getBackgroundClass()} text-white overflow-auto`}>
      <main className="container mx-auto px-4 py-8 flex flex-col items-center min-h-screen">
        <h1 className="text-4xl font-bold mb-8 drop-shadow-md text-center">WhatToWear</h1>
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-lg mb-8 relative">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Şehir girin..."
                className="p-3 pl-10 pr-8 rounded-lg w-full text-white placeholder-white/70 bg-white/10 border border-white/20 focus:border-white/50 focus:outline-none transition-all"
              />
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-white/70" />
              {city && (
                <button
                  type="button"
                  onClick={() => setCity("")}
                  className="absolute right-3 top-3.5 h-4 w-4 text-white/70 hover:text-white"
                >
                  <X />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center justify-center disabled:opacity-50"
            >
              {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : "Ara"}
            </button>
          </form>
        </div>

        {error && (
          <div className="w-full max-w-md bg-red-500/20 backdrop-blur-md p-4 rounded-lg mb-8 text-center">
            {error}
          </div>
        )}

        {weather && dailyForecast.length > 0 && (
          <div className="w-full max-w-4xl">
            <div className="w-full flex justify-center mb-6">
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-1 inline-flex">
                <button
                  onClick={() => setShowDailyView(false)}
                  className={`px-4 py-2 rounded-md flex items-center ${!showDailyView ? 'bg-white/20' : ''}`}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Saatlik
                </button>
                <button
                  onClick={() => setShowDailyView(true)}
                  className={`px-4 py-2 rounded-md flex items-center ${showDailyView ? 'bg-white/20' : ''}`}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Günlük
                </button>
              </div>
            </div>

            <div className="w-full bg-black/20 backdrop-blur-md rounded-xl shadow-lg overflow-hidden mb-6">
              <div className="p-6 text-center">
                <h2 className="text-3xl font-bold mb-1">{weather.name}</h2>
                <p className="text-sm mb-4 opacity-70">
                  {formatDate(dailyForecast[activeDay]?.dt || (Date.now() / 1000), 'full')}
                </p>
                <div className="flex flex-col md:flex-row items-center justify-center">
                  <img
                    src={getWeatherIcon(dailyForecast[activeDay]?.weather[0]?.icon || (weather.weather && weather.weather[0]?.icon))}
                    alt="Hava Durumu İkonu"
                    className="w-32 h-32 my-2"
                  />
                  <div className="text-center">
                    <p className="text-6xl font-bold">
                      {Math.round(
                        showDailyView
                          ? dailyForecast[activeDay]?.temp.day || weather.main.temp
                          : weather.main.temp
                      )}°
                    </p>
                    <p className="text-xl capitalize opacity-90">
                      {(showDailyView
                        ? dailyForecast[activeDay]?.weather[0]?.description
                        : (weather.weather && weather.weather[0]?.description)) || ""}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <div className="bg-white/10 p-3 rounded-lg flex items-center">
                    <Thermometer className="h-5 w-5 mr-2" />
                    <div>
                      <p className="text-sm opacity-70">Hissedilen</p>
                      <p className="font-semibold">
                        {Math.round(
                          showDailyView
                            ? dailyForecast[activeDay]?.feels_like.day || weather.main.feels_like
                            : weather.main.feels_like
                        )}°C
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-lg flex items-center">
                    <Droplets className="h-5 w-5 mr-2" />
                    <div>
                      <p className="text-sm opacity-70">Nem</p>
                      <p className="font-semibold">
                        {showDailyView
                          ? dailyForecast[activeDay]?.humidity || weather.main.humidity
                          : weather.main.humidity}%
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-lg flex items-center">
                    <Wind className="h-5 w-5 mr-2" />
                    <div>
                      <p className="text-sm opacity-70">Rüzgar</p>
                      <p className="font-semibold">
                        {Math.round(
                          showDailyView
                            ? dailyForecast[activeDay]?.wind_speed || weather.wind.speed
                            : weather.wind.speed
                        )} km/s
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-white/5 rounded-lg">
                  <p className="text-sm italic">
                    🧥 {getClothingAdvice(
                      showDailyView
                        ? dailyForecast[activeDay]?.temp.day || weather.main.temp
                        : weather.main.temp
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {showDailyView ? "7 Günlük Tahmin" : "Saatlik Tahmin"}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => scrollCards("left")}
                  className="bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => scrollCards("right")}
                  className="bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {showDailyView ? (
              <div
                ref={cardsRef}
                className="flex overflow-x-auto pb-4 gap-4 hide-scrollbar"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {dailyForecast.map((day, index) => (
                  <div
                    key={index}
                    onClick={() => changeActiveDay(index)}
                    className={`flex-none w-36 p-4 rounded-xl shadow-lg cursor-pointer ${
                      index === activeDay
                        ? "bg-black/10 backdrop-blur-md border"
                        : "bg-black/20 backdrop-blur-md hover:bg-white/10"
                    }`}
                  >
                    <p className="text-center font-medium mb-2">
                      {formatDate(day.dt, "day")}
                    </p>
                    <div className="flex flex-col items-center">
                      <img
                        src={getWeatherIcon(day.weather[0].icon)}
                        alt="Hava Durumu"
                        className="w-16 h-16"
                      />
                      <p className="text-lg font-bold my-1">{Math.round(day.temp.day)}°</p>
                      <p className="text-xs opacity-70">
                        {Math.round(day.temp.min)}° / {Math.round(day.temp.max)}°
                      </p>
                      <p className="text-xs mt-2 capitalize truncate w-full text-center">
                        {day.weather[0].description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                ref={cardsRef}
                className="flex overflow-x-auto pb-4 gap-4 hide-scrollbar"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {getHourlyForecastForActiveDay().map((hour, index) => (
                  <div
                    key={index}
                    className="flex-none w-28 p-4 rounded-xl shadow-lg bg-black/20 backdrop-blur-md"
                  >
                    <p className="text-center font-medium mb-2">
                      {formatDate(hour.dt, "hour")}
                    </p>
                    <div className="flex flex-col items-center">
                      <img
                        src={getWeatherIcon(hour.weather[0].icon)}
                        alt="Hava Durumu"
                        className="w-14 h-14"
                      />
                      <p className="text-lg font-bold my-1">{Math.round(hour.main.temp)}°</p>
                      <div className="flex items-center justify-center text-xs mt-1">
                        <Wind className="h-3 w-3 mr-1" />
                        <span>{Math.round(hour.wind.speed)} km/s</span>
                      </div>
                      <div className="flex items-center justify-center text-xs mt-1">
                        <Droplets className="h-3 w-3 mr-1" />
                        <span>{hour.main.humidity}%</span>
                      </div>
                    </div>
                  </div>
                ))}
                {getHourlyForecastForActiveDay().length === 0 && (
                  <div className="flex-1 flex items-center justify-center h-32">
                    <p className="text-white/70">Bu gün için saatlik tahmin bulunmuyor</p>
                  </div>
                )}
              </div>
            )}

            <style jsx global>{`
              .hide-scrollbar::-webkit-scrollbar {
                display: none;
              }
            `}</style>
          </div>
        )}

        {!weather && !error && (
          <div className="flex flex-col items-center justify-center flex-1">
            {loading ? (
              <div className="text-center">
                <RefreshCw className="h-12 w-12 animate-spin text-white/70 mx-auto mb-4" />
                <p className="text-white/70">Hava durumu bilgileri alınıyor...</p>
              </div>
            ) : (
              <p className="text-white/70">Lütfen bir şehir adı girin</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
