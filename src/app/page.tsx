"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Search, Droplets, Wind, Thermometer } from "lucide-react";

export default function Home() {
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<any>(null);
  const [error, setError] = useState("");

  // Kullanıcının konumunu al
  useEffect(() => {
    const getLocation = async () => {
      setLoading(true);
      try {
        if ("geolocation" in navigator) {
          const positionPromise = new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (position) => resolve(position),
              (err) => reject(new Error("Konum erişimi reddedildi veya mevcut değil")),
              { timeout: 10000, enableHighAccuracy: false }
            );
          });
          
          try {
            const position = await positionPromise;
            const { latitude, longitude } = position.coords;
            await getWeatherByCoordinates(latitude, longitude);
          } catch (err) {
            console.log("Konum alınamadı, varsayılan şehir kullanılacak");
            // Varsayılan olarak İstanbul hava durumunu göster
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

  const getWeatherByCoordinates = async (lat: number, lon: number) => {
    setLoading(true);
    setError("");
    try {
      const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
      if (!apiKey) {
        throw new Error("API anahtarı bulunamadı");
      }
      
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=tr&appid=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`API yanıt hatası: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.cod === 200) {
        setCity(data.name);
        setWeather(data);
      } else {
        setError(`Hava durumu verisi alınamadı: ${data.message || 'Bilinmeyen hata'}`);
      }
    } catch (error) {
      console.error("Hava durumu API hatası:", error);
      setError("Hava durumu verisi alınamadı. Lütfen manuel olarak şehir arayın.");
    } finally {
      setLoading(false);
    }
  };

  const handleCitySearch = async (cityName: string) => {
    if (!cityName.trim()) return;

    setLoading(true);
    setError("");
    try {
      const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
      if (!apiKey) {
        throw new Error("API anahtarı bulunamadı");
      }
      
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
    
    // Gün/gece durumunu kontrol et, eğer sunset verisi yoksa varsayılan olarak gün kabul et
    const isDay = weather.sys && weather.sys.sunset 
      ? new Date().getTime() / 1000 < weather.sys.sunset
      : true;
    
    const temp = weather.main.temp;
    
    if (isDay) {
      if (temp >= 25) return "from-orange-300 to-orange-600"; // Sıcak ve gündüz
      if (temp >= 15) return "from-blue-300 to-blue-500"; // Ilık ve gündüz
      if (temp >= 5) return "from-blue-200 to-blue-400"; // Serin ve gündüz
      return "from-blue-100 to-blue-300"; // Soğuk ve gündüz
    } else {
      if (temp >= 20) return "from-purple-700 to-purple-900"; // Sıcak ve gece
      if (temp >= 10) return "from-blue-800 to-blue-950"; // Ilık ve gece
      return "from-indigo-900 to-blue-950"; // Soğuk ve gece
    }
  };

  const getWeatherIcon = () => {
    if (!weather || !weather.weather || !weather.weather[0] || !weather.weather[0].icon) {
      return "https://openweathermap.org/img/wn/10d@4x.png"; // Varsayılan ikon
    }
    return `https://openweathermap.org/img/wn/${weather.weather[0].icon}@4x.png`;
  };

  return (
    <div className={`min-h-screen w-full bg-gradient-to-b ${getBackgroundClass()} text-white overflow-auto`}>
      <main className="container mx-auto px-4 py-8 flex flex-col items-center min-h-screen">
        <h1 className="text-4xl font-bold mb-8 drop-shadow-md text-center">
          WhatToWear
        </h1>
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-lg mb-8">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Şehir girin..."
                className="p-3 pl-10 rounded-lg w-full text-white placeholder-white/70 bg-white/10 border border-white/20 focus:border-white/50 focus:outline-none transition-all"
              />
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-white/70" />
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

        {weather && (
          <div className="w-full max-w-md bg-black/20 backdrop-blur-md rounded-xl shadow-lg overflow-hidden">
            <div className="p-6 text-center">
              <h2 className="text-3xl font-bold mb-1">{weather.name}</h2>
              <div className="flex flex-col md:flex-row items-center justify-center">
                <img
                  src={getWeatherIcon()}
                  alt="Hava Durumu İkonu"
                  className="w-32 h-32 my-2"
                />
                <div className="text-center">
                  <p className="text-6xl font-bold">
                    {Math.round(weather.main.temp)}°
                  </p>
                  <p className="text-xl capitalize opacity-90">
                    {weather.weather && weather.weather[0] ? weather.weather[0].description : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                <div className="bg-white/10 p-3 rounded-lg flex items-center">
                  <Thermometer className="h-5 w-5 mr-2" />
                  <div>
                    <p className="text-sm opacity-70">Hissedilen</p>
                    <p className="font-semibold">
                      {Math.round(weather.main.feels_like)}°C
                    </p>
                  </div>
                </div>

                <div className="bg-white/10 p-3 rounded-lg flex items-center">
                  <Droplets className="h-5 w-5 mr-2" />
                  <div>
                    <p className="text-sm opacity-70">Nem</p>
                    <p className="font-semibold">{weather.main.humidity}%</p>
                  </div>
                </div>

                <div className="bg-white/10 p-3 rounded-lg flex items-center sm:col-span-2">
                  <Wind className="h-5 w-5 mr-2" />
                  <div>
                    <p className="text-sm opacity-70">Rüzgar</p>
                    <p className="font-semibold">
                      {Math.round(weather.wind.speed)} km/s
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-white/5 rounded-lg">
                <p className="text-sm italic">
                  🧥 {getClothingAdvice(weather.main.temp)}
                </p>
              </div>
            </div>
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
