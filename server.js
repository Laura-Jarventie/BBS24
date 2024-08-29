import express, { text } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import multer from 'multer';
import vision from '@google-cloud/vision';
import fs from 'fs';

dotenv.config();



const app = express();
const port = 3000;

// Luo multer-instanssi, joka tallettaa ladatut tiedostot uploads-hakemistoon
const upload = multer({ dest: 'uploads/'  });

app.use(bodyParser.json());
app.use(express.static('public'));

//GCV tapa luoda uusi asiakas objekti
const client = new vision.ImageAnnotatorClient({
    keyFilename: 'omaope-vision.json' // Käytetään kiinteästi määriteltyä tiedostoa
});

let koealueTekstina = ''; //tähän tullaan yhdistään kaikkien kuvien teksti
let context =[]; //Chat GPI keskustelu lista
let currentQuestion = ''; //Muuttuja kysymyksen tallentamiseen
let correctAnswer = ''; // Muuttuja oikean vastauksen tallentamiseen



//kuvien vastaanotto, max 10 kuvaa
app.post('/upload-Images', upload.array('images', 10), async (req, res) => {
    console.log('Received images upload');
    //console.log(req);
    const files = req.files;

     //tiedoston validointi   
     if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded.' });
    }

    try {
         //OCR-tunnistus: kuva tekstiksi
        const texts = await Promise.all(files.map(async file => {
        const imagePath = file.path;
        console.log(imagePath);
        const [result] = await client.textDetection(imagePath);
        const detections = result.textAnnotations;
        fs.unlinkSync(imagePath); // Poista väliaikainen tiedosto
        return detections.length > 0 ? detections[0].description : '';
    }));
        
    //console.log(texts);
   koealueTekstina = texts.join('')
   console.log('OCR combined text:', koealueTekstina);

   context = [{ role: 'user', content: koealueTekstina }]; 
   /* 
   context = context.concat([
    { role: 'user', content: 'Luo yksi yksinkertainen ja selkeä koetehtävä ja sen vastaus yllä olevasta tekstistä suomeksi. Kysy vain yksi asia kerrallaan.' }
  ]); */
  console.log(context);
  
   const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: context.concat([
        { role: 'user', content: 'Luo yksi yksinkertainen ja selkeä kysymys ja sen vastaus yllä olevasta tekstistä suomeksi. Kysy vain yksi asia kerrallaan.' }
      ]),
      max_tokens: 150
    })

    });

    //vastaanota api ja muuta se json:ksi
    const data = await response.json();
    console.log(data.choices[0].message);
    console.log('API response:', JSON.stringify(data));

    //Api vastauksen käsittely
    const responseText = data.choices[0].message.content.trim();
    console.log('Response Text:', responseText); 

    const [question, answer] = responseText.includes('Vastaus:')
            ? responseText.split('Vastaus:')
            : [responseText, null]; 

    console.log('Parsed Question:', question);
    console.log('Parsed Answer:', answer);

    if (!question || !answer) {
        return res.status(400).json({ error: 'Model could not generate a valid question. Please provide a clearer text.' });
    }


    currentQuestion = question.trim();
    correctAnswer = answer.trim();

    //päivitetään Chat GPI keskustelun kysymyksellä ja vastauksella. Jotta ChatGPI tietää mitä aiemmin keskusteltu.
    context.push({ role: 'assistant', content: `Kysymys: ${currentQuestion}` });
    context.push({ role: 'assistant', content: `Vastaus: ${correctAnswer}` });

    res.json({ question: currentQuestion, answer: correctAnswer }); 

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

 



//luetaan frontin kysymys requestista  
 app.post('/chat', async (req, res) => {
    const question = req.body.question;
    console.log(question);

  /* //palautetaan vastaus res.json käskyllä testivaiheessa kun luodaan yhteys frontilta serveriin ja takasin frontille:
  if (question) {
    res.json({ question: `Tämä on serverin palauttama viesti frontille: ${question}` });
  } else {
    res.status(400).json({ error: 'Kysymys puuttuu.' });
} */
 

     //lähetetään kysymys ChatGPT:lle   
     try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'user', content: question }
              ],
              max_tokens: 150
      })
    });

    //vastaanotetaan ja käsitellään API-vastaus    
    const data = await response.json();
    console.log('API response:', data.choices[0].message.content);

       if (!data.choices || data.choices.length === 0) {
         throw new Error('No choices returned from API');
     }  

     const reply = data.choices[0].message.content;
     res.json({ reply });

    } catch (error) {
    console.error('Virheviesti:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
    } 
    
}); 

app.post('/check-answer', async(req, res) => {
  const userAnswer = req.body.user_answer;
  console.log(userAnswer);
  console.log(correctAnswer);

  try {

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Olet aina vihainen opettaja joka arvioi oppilaan vastauksen ilkeään sävyyn.' },
          { role: 'user', content: `Kysymys: ${currentQuestion}` },
          { role: 'user', content: `Oikea vastaus: ${correctAnswer}` },
          { role: 'user', content: `Opiskelijan vastaus: ${userAnswer}` },
          { role: 'user', content: 'Arvioi opiskelijan vastaus asteikolla 0-10 ja anna lyhyt selitys. Hauku oppilas.' }
        ],
        max_tokens: 150
      })
    });

     //vastaanotetaan ja käsitellään API-vastaus    
     const data = await response.json();
     //console.log('API response:', JSON.stringify(data));

     const evaluation = data.choices[0].message.content.trim();
     console.log('Evaluation:', evaluation);

     res.json({ evaluation });  


  } catch (error) {
  console.error('Virheviesti:', error.message);
  res.status(500).json({ error: 'Internal Server Error' });
  }



});



app.post('/next-question', async (req, res) => {
  console.log('Fetching next question');

  try {

      // Generate the next question in Finnish using GPT-4
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: context.concat([{ role: 'user', content: 'Luo toinen yksinkertainen ja selkeä koetehtävä ja sen vastaus yllä olevasta tekstistä suomeksi: "${combinedText}". Kysy vain yksi asia kerrallaan.' }]),
              max_tokens: 150
          })
      });

      const data = await response.json();
      console.log('API response:', JSON.stringify(data, null, 2));

      if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
          throw new Error('No valid choices returned from API');
      }

      const responseText = data.choices[0].message.content.trim();
      console.log('Response Text:', responseText);

      const [question, answer] = responseText.includes('Vastaus:')
          ? responseText.split('Vastaus:')
          : [responseText, null];

      console.log('Parsed Question:', question);
      console.log('Parsed Answer:', answer);

      if (!question || !answer) {
          return res.status(400).json({ error: 'Model could not generate a valid question. Please provide a clearer text.' });
      }

      currentQuestion = question.trim(); // Päivitetään nykyinen kysymys
      correctAnswer = answer.trim(); // Päivitetään oikea vastaus

      // Update context with the new question and answer
      context.push({ role: 'assistant', content: `Kysymys: ${currentQuestion}` });
      context.push({ role: 'assistant', content: `Vastaus: ${correctAnswer}` });

      res.json({ question: currentQuestion, answer: correctAnswer });
  } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ error: error.message });
  }
});


app.listen(port, () => {
    console.log(`Server running http://localhost:${port}`);
}
);




/* TYHJÄ MALLI BACK-END RAJAPINNASTA
//luetaan frontin kysymys requestista  
app.post('/chat', (req, res) => {
    const question = req.body.question;
    console.log(question);

    try {

    } catch (error) {
    console.error('Virheviesti:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
    }
  
});  */