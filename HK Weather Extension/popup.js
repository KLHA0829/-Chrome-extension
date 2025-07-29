const stationCoords = { '京士柏':{lat:22.309,lon:114.172},'香港天文台':{lat:22.302,lon:114.174},'黃竹坑':{lat:22.249,lon:114.177},'打鼓嶺':{lat:22.502,lon:114.145},'流浮山':{lat:22.469,lon:113.985},'大埔':{lat:22.449,lon:114.177},'沙田':{lat:22.392,lon:114.191},'屯門':{lat:22.404,lon:113.974},'將軍澳':{lat:22.315,lon:114.258},'西貢':{lat:22.383,lon:114.270},'長洲':{lat:22.209,lon:114.028},'赤鱲角':{lat:22.308,lon:113.916},'青衣':{lat:22.348,lon:114.108},'石崗':{lat:22.433,lon:114.086},'荃灣可觀':{lat:22.382,lon:114.111},'荃灣城門谷':{lat:22.382,lon:114.111},'香港公園':{lat:22.278,lon:114.161},'筲箕灣':{lat:22.280,lon:114.227},'跑馬地':{lat:22.270,lon:114.183},'黃大仙':{lat:22.341,lon:114.191},'赤柱':{lat:22.215,lon:114.214},'觀塘':{lat:22.311,lon:114.223},'深水埗':{lat:22.332,lon:114.160},'啓德跑道公園':{lat:22.306,lon:114.211},'元朗公園':{lat:22.441,lon:114.019},'坪洲':{lat:22.286,lon:114.039}};

function getDistance(coords1, coords2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
    const dLon = (coords2.lon - coords1.lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestStation(targetCoords, availableStations) {
    let nearestStation = null;
    let minDistance = Infinity;
    for (const stationName of availableStations) {
        const station = stationCoords[stationName];
        if (station) {
            const distance = getDistance(targetCoords, station);
            if (distance < minDistance) {
                minDistance = distance;
                nearestStation = stationName;
            }
        }
    }
    return nearestStation;
}

function getTempClass(temp) {
    const tempVal = parseFloat(temp);
    if (isNaN(tempVal)) return '';
    if (tempVal >= 30) return 'temp-hot';
    if (tempVal >= 25) return 'temp-warm';
    if (tempVal < 20) return 'temp-cool';
    return '';
}

function formatHtmlReport(data, sourceStationName = null) {
    let html = '';
    const { current, forecast } = data;

    if (sourceStationName) {
        const title = `根據您偵測到的位置所做的天氣報告 (數據來自最接近的 ${sourceStationName} 氣象站)`;
        html += `<h2>${title}</h2>`;

        let districtTemp = "沒有數據", districtRain = "沒有雨量數據";
        current.temperature.data.forEach(item => {
            if (item.place === sourceStationName) districtTemp = item.value ?? '沒有數據';
        });
        if (current.rainfall) {
            current.rainfall.data.forEach(item => {
                if (item.place === sourceStationName && item.max !== undefined) {
                    districtRain = `${item.min ?? item.max}-${item.max} ${item.unit}`;
                }
            });
        }
        html += `<p><b>氣溫：</b><span class="${getTempClass(districtTemp)}">${districtTemp} °C</span></p>`;
        html += `<p><b>過去一小時雨量：</b>${districtRain}</p>`;
    }
    
    html += `<h2>香港整體天氣報告</h2>`;
    const overallTemp = current.temperature.data[0]?.value ?? 'N/A';
    html += `<p><b>香港天文台總部氣溫：</b><span class="${getTempClass(overallTemp)}">${overallTemp} °C</span></p>`;
    html += `<p><b>相對濕度：</b>${current.humidity.data[0]?.value ?? 'N/A'} %</p>`;
    if (current.uvindex) {
        html += `<p><b>紫外線指數：</b>${current.uvindex.data[0]?.value ?? 'N/A'} (${current.uvindex.desc})</p>`;
    }
    if (current.warningMessage?.length > 0) {
        html += `<h3>天氣警告：</h3><ul>${current.warningMessage.map(w => `<li>${w}</li>`).join('')}</ul>`;
    } else {
        html += `<p><b>天氣警告：</b>現時沒有天氣警告生效。</p>`;
    }

    html += `<h2>今日天氣預測</h2>`;
    html += `<p><b>天氣概況：</b>${forecast.generalSituation ?? ''}</p>`;
    html += `<p><b>預測詳情：</b>${forecast.forecastDesc ?? ''}</p>`;
    html += `<p><b>展望：</b>${forecast.outlook ?? ''}</p>`;
    
    if (current.updateTime) {
        const updateTime = new Date(current.updateTime).toLocaleString('zh-HK');
        html += `<hr><p><i>即時天氣資料發布時間：${updateTime}</i></p>`;
    }
    return html;
}

document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');
    const contentDiv = document.getElementById('report-content');

    // Helper function to fetch weather data from the API
    async function fetchWeatherData() {
        const [currentRes, forecastRes] = await Promise.all([
            fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc'),
            fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=tc')
        ]);

        if (!currentRes.ok || !forecastRes.ok) {
            throw new Error('無法從香港天文台獲取數據。');
        }

        const current = await currentRes.json();
        const forecast = await forecastRes.json();
        return { current, forecast };
    }

    // Displays weather report, with or without a specific station
    async function displayWeather(stationName = null, userCoords = null) {
        try {
            statusDiv.textContent = '正在獲取天氣數據...';
            const weatherData = await fetchWeatherData();
            let nearestStation = stationName;

            // If we have user coordinates, find the nearest station from the fetched data
            if (userCoords) {
                const availableStations = weatherData.current.temperature.data.map(s => s.place);
                nearestStation = findNearestStation(userCoords, availableStations);
            }
            
            statusDiv.style.display = 'none';
            contentDiv.innerHTML = formatHtmlReport(weatherData, nearestStation);

        } catch (error) {
            statusDiv.innerHTML = `<h2 style="color: #e06c75;">錯誤</h2><p>${error.message}</p>`;
        }
    }

    statusDiv.textContent = '正在偵測您的位置...';

    navigator.geolocation.getCurrentPosition(
        // Success Callback: We have the user's location
        (position) => {
            const { latitude, longitude } = position.coords;
            displayWeather(null, { lat: latitude, lon: longitude });
        },
        // Error Callback: We could not get the user's location
        (error) => {
            let message = '無法偵測您的位置，將顯示香港整體天氣。';
            if (error.code === 1) { // PERMISSION_DENIED
                message = '您已拒絕位置資訊請求，將顯示香港整體天氣。';
            }
            statusDiv.textContent = message;
            // Display the general weather report without a specific station
            displayWeather();
        },
        // Geolocation options
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
});
