globalThis.fetch = async () => {
  throw new Error('Имитируем недоступность MOEX, проверяем сохранность снимка');
};
