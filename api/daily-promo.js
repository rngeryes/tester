// Vercel Serverless Function для выдачи ежедневного промокода
// Промокоды защищены на сервере, клиент получает только один код в день
// Использует Vercel KV для хранения состояния

import { kv } from '@vercel/kv';
import promoCodes from './promo_codes.json';

// Ключи для хранения в KV
const CURRENT_INDEX_KEY = 'promo_current_index';
const LAST_UPDATE_KEY = 'promo_last_update';
const START_DATE_KEY = 'promo_start_date';

export default async function handler(req, res) {
  // CORS headers для доступа с фронтенда
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Получаем московское время (UTC+3)
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const moscowTime = new Date(utc + (3600000 * 3));
    
    // Получаем дату в московском времени (только дата, без времени)
    const moscowDateString = moscowTime.toDateString();
    
    // Получаем текущее состояние из KV
    let currentIndex = await kv.get(CURRENT_INDEX_KEY);
    let lastUpdate = await kv.get(LAST_UPDATE_KEY);
    let startDate = await kv.get(START_DATE_KEY);
    
    // Инициализация при первом запуске
    if (currentIndex === null) {
      currentIndex = 0;
      startDate = moscowDateString;
      await kv.set(CURRENT_INDEX_KEY, currentIndex);
      await kv.set(START_DATE_KEY, startDate);
      await kv.set(LAST_UPDATE_KEY, moscowDateString);
      console.log('🎉 Initialized promo system. Start date:', startDate);
    }
    
    // Проверяем, нужно ли обновить промокод (новый день)
    if (lastUpdate !== moscowDateString) {
      // Новый день! Переходим к следующему промокоду
      currentIndex = (currentIndex + 1) % promoCodes.length;
      
      // Сохраняем новое состояние
      await kv.set(CURRENT_INDEX_KEY, currentIndex);
      await kv.set(LAST_UPDATE_KEY, moscowDateString);
      
      console.log(`📅 New day! Updated to promo #${currentIndex} (${moscowDateString})`);
    }
    
    // Получаем промокод дня
    const dailyPromo = promoCodes[currentIndex];
    
    // Вычисляем время до следующего промокода
    const tomorrow = new Date(moscowTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilNext = tomorrow - moscowTime;
    
    // Возвращаем только один промокод + метаданные
    return res.status(200).json({
      success: true,
      promo: dailyPromo,
      promoIndex: currentIndex,
      moscowDate: moscowDateString,
      timeUntilNext: timeUntilNext,
      totalPromos: promoCodes.length,
      startDate: startDate
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message
    });
  }
}
