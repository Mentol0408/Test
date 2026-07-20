(async () => {
  const serverName = 'chill';
  
  const res = await fetch('http://localhost:3000/api/server-status', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'x-api-key': 'S6aR5ttlaAbpKk7hi5AvIOfo3HcfDpeHL5AKYDQA1pw79BuICB1tPXeeXJaf7rZ9pQuazSfBt6oOjgQdYmOpnRzMIhZGUbFM7p6gf9hxD8w67SzcIoCjeE4luXr7ugaQ' 
    },
    body: JSON.stringify({ 
      server: serverName,
      mapSize: 3500, 
      lastWipe: 1766078413514, 
      nextWipe: 1766078413514, 
      openedCases: 55, 
      online: 5,
      players: [
        {
          steamId: '76561198000000000',
          trackedMinutes: 320,
          activityDate: new Date().toISOString().slice(0, 10),
        }
      ]
    })
  });
  console.log(await res.json());
})().catch(console.error);