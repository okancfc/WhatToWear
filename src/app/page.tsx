"use client";

import { useEffect, useState, useRef } from "react";
import {
  RefreshCw,
  Search,
  X,
  Droplets,
  Wind,
  Thermometer,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
} from "lucide-react";

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

  // Sayfa ilk yüklendiğinde geolocation ile konum al
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

  // Koordinatlar ile hava durumu verilerini çek
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

  // 5 günlük / 3 saatlik tahmin verisi
  const getForecastByCoordinates = async (lat: number, lon: number) => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
      if (!apiKey) throw new Error("API anahtarı bulunamadı");

      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=tr&appid=${apiKey}`
      );
      if (!forecastResponse.ok) throw new Error(`Forecast API yanıt hatası: ${forecastResponse.status}`);
      const forecastData = await forecastResponse.json();

      // Saatlik veriler
      setHourlyForecast(forecastData.list);

      // Günlük tahminleri gruplandırma
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

  // Manuel şehir arama
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
        setError(`Hava durumu verisi alınamadı: ${data.message || "Bilinmeyen hata"}`);
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

  // Arka plan sınıfı
  const getCardBackgroundClass = () => {
    if (!weather) return "bg-gradient-to-b from-blue-400 to-blue-600";

    const now = Math.floor(new Date().getTime() / 1000);
    const { sunrise, sunset } = weather.sys;
    const isDay = sunrise && sunset ? now >= sunrise && now < sunset : true;
    const temp = weather.main.temp;

    if (isDay) {
      if (temp >= 25) return "bg-gradient-to-b from-orange-400 to-orange-600";
      if (temp >= 15) return "bg-gradient-to-b from-blue-400 to-blue-500";
      if (temp >= 5) return "bg-gradient-to-b from-blue-300 to-blue-400";
      return "bg-gradient-to-b from-blue-200 to-blue-300";
    } else {
      if (temp >= 20) return "bg-gradient-to-b from-purple-800 to-purple-900";
      if (temp >= 10) return "bg-gradient-to-b from-blue-200 to-blue-950";
      return "bg-gradient-to-b from-indigo-900 to-blue-950";
    }
  };

  // Tüm günlük kartlar için ortak arka plan
  const getDailyCardBackground = (temp: number) => {
    if (temp >= 25) return "bg-gradient-to-b from-orange-500 to-orange-600";
    if (temp >= 15) return "bg-gradient-to-b from-blue-400 to-blue-500";
    if (temp >= 5) return "bg-gradient-to-b from-blue-300 to-blue-400";
    return "bg-gradient-to-b from-blue-200 to-blue-300";
  };

  // İkon URL'sini oluşturur
  const getWeatherIcon = (iconCode?: string) => {
    if (!iconCode) {
      if (weather && weather.weather[0]?.icon) {
        iconCode = weather.weather[0].icon;
      } else {
        return "https://openweathermap.org/img/wn/10d@4x.png";
      }
    }
    return `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
  };

  // Tarih formatlama
  const formatDate = (
    timestamp: number,
    format: "day" | "hour" | "full" = "full"
  ) => {
    const date = new Date(timestamp * 1000);
    const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const months = [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık",
    ];
    if (format === "day") return days[date.getDay()];
    else if (format === "hour") return `${date.getHours()}:00`;
    else return `${date.getDate()} ${months[date.getMonth()]} ${days[date.getDay()]}`;
  };

  // Yana kaydırma fonksiyonu
  const scrollCards = (direction: "left" | "right") => {
    if (!cardsRef.current) return;
    const scrollAmount = 300;
    cardsRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Aktif günü değiştirme (scrollLeft kaldırıldı)
  const changeActiveDay = (index: number) => {
    setActiveDay(index);
  };

  // Seçili güne ait saatlik tahmin
  const getHourlyForecastForActiveDay = () => {
    if (hourlyForecast.length === 0) return [];
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + activeDay);

    return hourlyForecast.filter((item) => {
      const itemDate = new Date(item.dt * 1000);
      return (
        itemDate.getDate() === targetDate.getDate() &&
        itemDate.getMonth() === targetDate.getMonth() &&
        itemDate.getFullYear() === targetDate.getFullYear()
      );
    });
  };

  return (
    <div className="min-h-screen w-full">
      <main className="container mx-auto px-4 py-8 flex flex-col items-center min-h-screen">
        <div className="flex gap-2">
          <img src="logo.png" alt="" className="w-13 h-8.5" />
          <h1 className="text-4xl font-bold mb-8 text-center text-black">
            WhatToWear
          </h1>
        </div>
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md p-6 rounded-xl shadow-lg mb-8 relative border border-gray-200">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Şehir girin..."
                className="p-3 pl-10 pr-8 rounded-lg w-full text-gray-800 placeholder-gray-500 bg-white/80 border border-gray-300 focus:border-gray-500 focus:outline-none transition-all"
              />
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
              {city && (
                <button
                  type="button"
                  onClick={() => setCity("")}
                  className="absolute right-3 top-3.5 h-4 w-4 text-gray-500 hover:text-gray-700"
                >
                  <X />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-gray-700 hover:bg-gray-800 text-white font-medium px-4 py-2 rounded-lg transition-all flex items-center justify-center disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                "Ara"
              )}
            </button>
          </form>
        </div>

        {error && (
          <div className="w-full max-w-md bg-red-500/20 backdrop-blur-md p-4 rounded-lg mb-8 text-center text-red-800 border border-red-200">
            {error}
          </div>
        )}

        {weather && dailyForecast.length > 0 && (
          <div className="w-full max-w-4xl">
            <div className="w-full flex justify-center mb-6">
              <div className="bg-white/80 backdrop-blur-md rounded-lg p-1 inline-flex shadow-md">
                <button
                  onClick={() => setShowDailyView(false)}
                  className={`px-4 py-2 rounded-md flex items-center text-gray-700 ${
                    !showDailyView ? "bg-gray-200" : ""
                  }`}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Saatlik
                </button>
                <button
                  onClick={() => setShowDailyView(true)}
                  className={`px-4 py-2 rounded-md flex items-center text-gray-700 ${
                    showDailyView ? "bg-gray-200" : ""
                  }`}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Günlük
                </button>
              </div>
            </div>

            {/* Günlük Görünüm - Üstteki büyük kart */}
            {showDailyView && (
              <div
                className={`${getCardBackgroundClass()}  rounded-xl shadow-lg overflow-hidden mb-6 text-white`}
              >
                <div className="p-6 text-center">
                  <h2 className="text-3xl font-bold mb-1">{weather.name}</h2>
                  <p className="text-sm mb-4 opacity-70">
                    {formatDate(
                      dailyForecast[activeDay]?.dt || Date.now() / 1000,
                      "full"
                    )}
                  </p>
                  <div className="flex flex-col md:flex-row items-center justify-center">
                    <img
                      src={getWeatherIcon(
                        dailyForecast[activeDay]?.weather[0]?.icon ||
                          weather.weather[0]?.icon
                      )}
                      alt="Hava Durumu İkonu"
                      className="w-32 h-32 my-2"
                    />
                    <div className="text-center">
                      <p className="text-6xl font-bold">
                        {Math.round(
                          dailyForecast[activeDay]?.temp.day ||
                            weather.main.temp
                        )}
                        °
                      </p>
                      <p className="text-xl capitalize opacity-90">
                        {dailyForecast[activeDay]?.weather[0]?.description}
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
                            dailyForecast[activeDay]?.feels_like.day ||
                              weather.main.feels_like
                          )}
                          °C
                        </p>
                      </div>
                    </div>
                    <div className="bg-white/10 p-3 rounded-lg flex items-center">
                      <Droplets className="h-5 w-5 mr-2" />
                      <div>
                        <p className="text-sm opacity-70">Nem</p>
                        <p className="font-semibold">
                          {dailyForecast[activeDay]?.humidity ||
                            weather.main.humidity}
                          %
                        </p>
                      </div>
                    </div>
                    <div className="bg-white/10 p-3 rounded-lg flex items-center">
                      <Wind className="h-5 w-5 mr-2" />
                      <div>
                        <p className="text-sm opacity-70">Rüzgar</p>
                        <p className="font-semibold">
                          {Math.round(
                            dailyForecast[activeDay]?.wind_speed ||
                              weather.wind.speed
                          )}{" "}
                          km/s
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 p-4 bg-white/5 rounded-lg">
                    <p className="text-sm italic">
                      🧥{" "}
                      {getClothingAdvice(
                        dailyForecast[activeDay]?.temp.day ||
                          weather.main.temp
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Saatlik veya Günlük tahmin başlık */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {showDailyView ? "7 Günlük Tahmin" : `${weather.name} - Saatlik Tahmin`}
              </h3>
              {showDailyView && (
                <div className="flex gap-2">
                  <button
                    onClick={() => scrollCards("left")}
                    className="bg-gray-200 hover:bg-gray-300 rounded-full p-2 transition-all text-gray-700"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => scrollCards("right")}
                    className="bg-gray-200 hover:bg-gray-300 rounded-full p-2 transition-all text-gray-700"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Günlük Tahmin */}
            {showDailyView && (
              <div className="-mx-4">
                <div
                  ref={cardsRef}
                  className="flex overflow-x-auto pb-4 px-4 gap-4 hide-scrollbar"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  {dailyForecast.map((day, index) => {
                    const isActive = index === activeDay;
                    return (
                      <div
                        key={index}
                        onClick={() => changeActiveDay(index)}
                        className={`flex-none w-36 p-4 rounded-xl shadow-lg cursor-pointer text-white relative ${
                          getDailyCardBackground(day.temp.day)
                        } ${isActive ? "border-2 border-black" : "border-0"}`}
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
                          <p className="text-lg font-bold my-1">
                            {Math.round(day.temp.day)}°
                          </p>
                          <p className="text-xs opacity-70">
                            {Math.round(day.temp.min)}° /{" "}
                            {Math.round(day.temp.max)}°
                          </p>
                          <p className="text-xs mt-2 capitalize truncate w-full text-center">
                            {day.weather[0].description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Saatlik Tahmin - Tablo Tasarımı */}
            {!showDailyView && (
              <div className="w-full">
                {getHourlyForecastForActiveDay().length === 0 ? (
                  <div className="flex-1 flex items-center justify-center h-32 bg-gray-100 rounded-xl">
                    <p className="text-gray-600">
                      Bu gün için saatlik tahmin bulunmuyor
                    </p>
                  </div>
                ) : (
                  <div className={`rounded-xl shadow-lg overflow-hidden ${getCardBackgroundClass()}`}>
                    <div className="p-4 text-white">
                      <p className="text-center text-lg font-medium mb-2">
                        {formatDate(dailyForecast[activeDay]?.dt || Date.now() / 1000, "full")}
                      </p>
                      <div className="p-3 bg-white/5 rounded-lg inline-block mb-4 mx-auto text-center w-full">
                        <p className="text-sm italic">
                          🧥 {getClothingAdvice(weather.main.temp)}
                        </p>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/20">
                              <th className="pb-3 pr-6 text-left">Saat</th>
                              <th className="pb-3 px-4 text-center">Sıcaklık</th>
                              <th className="pb-3 px-4 text-center hidden md:table-cell">Hissedilen</th>
                              <th className="pb-3 px-4 text-center">Durum</th>
                              <th className="pb-3 px-4 text-center hidden sm:table-cell">Nem</th>
                              <th className="pb-3 px-4 text-center hidden sm:table-cell">Rüzgar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getHourlyForecastForActiveDay().map((hour, index) => (
                              <tr 
                                key={index} 
                                className={`${index % 2 === 0 ? 'bg-black/5' : ''}`}
                              >
                                <td className="py-4 pr-6 font-medium">
                                  {formatDate(hour.dt, "hour")}
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <div className="flex items-center justify-center">
                                    <span className="text-xl font-bold">
                                      {Math.round(hour.main.temp)}°
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center hidden md:table-cell">
                                  <div className="flex items-center justify-center">
                                    <Thermometer className="h-4 w-4 mr-1" />
                                    <span>{Math.round(hour.main.feels_like)}°</span>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center justify-center">
                                    <img 
                                      src={getWeatherIcon(hour.weather[0].icon)} 
                                      alt="Hava Durumu" 
                                      className="w-10 h-10 mr-1"
                                    />
                                    <span className="capitalize text-sm">
                                      {hour.weather[0].description}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center hidden sm:table-cell">
                                  <div className="flex items-center justify-center">
                                    <Droplets className="h-4 w-4 mr-1" />
                                    <span>{hour.main.humidity}%</span>
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-center hidden sm:table-cell">
                                  <div className="flex items-center justify-center">
                                    <Wind className="h-4 w-4 mr-1" />
                                    <span>{Math.round(hour.wind.speed)} km/s</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
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
                <RefreshCw className="h-12 w-12 animate-spin text-gray-500 mx-auto mb-4" />
                <p className="text-gray-600">Hava durumu bilgileri alınıyor...</p>
              </div>
            ) : (
              <p className="text-gray-600">Lütfen bir şehir adı girin</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}