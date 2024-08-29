let currentQuestion = ''; //Muuttuja kysymyksen tallentamiseen
let correctAnswer = ''; // Muuttuja oikean vastauksen tallentamiseen


document.getElementById('send-button').addEventListener('click', sendMessage);
document.getElementById('send-images-button').addEventListener('click', sendImages);
document.getElementById('send-answer-button').addEventListener('click', sendAnswer);

document.getElementById('user-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  document.getElementById('answer-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      sendAnswer();
    }
  });

  async function sendImages(){

    const imageInput = document.getElementById('image-input');
    const files = imageInput.files;
  
    if (files.length === 0) {
      alert('Valitse kuvia ensin.');
      return;
    }
    //hyvä tapa lähettää tiedostoja serverille
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }

    //logataan että nähdään tiedostot
    console.log(formData.getAll('images'));

     try {
      //lähetetään response serverille   
      const response = await fetch('/upload-Images', {
          method: 'POST',
          body: formData 
      });

      const data = await response.json();
      currentQuestion = data.question;
      correctAnswer = data.answer;
      console.log(currentQuestion);
      console.log(correctAnswer);
      addMessageToChatbox('OmaOpe: ' + data.question, 'bot-message', 'omaopebox');

    }  catch(error) {
      console.error('Error:', error);
      addMessageToChatbox('ChatGPT: Jotain meni pieleen. Yritä uudelleen myöhemmin.', 'bot-message', 'omaopebox');
  };  

  }


async function sendMessage(){
    const userInput = document.getElementById('user-input').value;
    if (userInput.trim() === '') return;
    console.log(userInput);

    addMessageToChatbox('Sinä:' + userInput, 'user-message', 'chatbox')

    try {
    //lähetetään response serverille   
    const response = await fetch('/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
                    },
        body: JSON.stringify({ question: userInput })    
    });
  
 /*  //lueataan serverin vastaus testaus vaiheessa kun luodaan yhteyttä:
  console.log(response);
  const data = await response.json();
  console.log(data.question); 
 */
   
    //lueataan serverin vastaus
    console.log(response);
    const data = await response.json();
    console.log(data.reply); 

    addMessageToChatbox('ChatGPT:'+data.reply, 'bot-message', 'chatbox'); 

  } catch(error) {
      console.error('Error:', error);
      addMessageToChatbox('ChatGPT: Jotain meni pieleen. Yritä uudelleen myöhemmin.', 'bot-message', 'chatbox');
  }; 

   document.getElementById('user-input').value = '';

}

async function sendAnswer(){
  const answerInput = document.getElementById('answer-input').value;
  if (answerInput.trim() === '') return;
  console.log(answerInput);

  addMessageToChatbox('Sinä:' + answerInput, 'user-message', 'omaopebox')

   try {
  //lähetetään vastaus serverille   
  const response = await fetch('/check-answer', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
                  },
      body: JSON.stringify({ user_answer: answerInput, correct_answer: correctAnswer })    
  });
 
  //lueataan serverin vastaus
 // console.log(response);
  const data = await response.json();
  console.log(data.evaluation); 

  addMessageToChatbox('Oma Ope:'+ data.evaluation, 'bot-message', 'omaopebox');  
  fetchNextQuestion();

 } catch(error) {
    console.error('Error:', error);
    addMessageToChatbox('ChatGPT: Jotain meni pieleen. Yritä uudelleen myöhemmin.', 'bot-message', 'omaopebox'); 
}; 

 document.getElementById('answer-input').value = '';

}

async function fetchNextQuestion() {
  
  try {

    const response = await fetch('/next-question', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json'
      },
      
  });

  const data = await response.json();
      currentQuestion = data.question;
      correctAnswer = data.answer;
      console.log(currentQuestion);
      console.log(correctAnswer);
      addMessageToChatbox('OmaOpe: ' + data.question, 'bot-message', 'omaopebox');

} catch(error) {
  console.error('Error:', error);
  addMessageToChatbox('ChatGPT: Jotain meni pieleen. Yritä uudelleen myöhemmin.', 'bot-message', 'omaopebox'); 
}; 
};

  /* .then(response => response.json())
  .then(data => {
      if (data.error) {
          addMessageToChatbox('Error: ' + data.error, 'bot-message');
      } else {
          currentQuestion = data.question;
          correctAnswer = data.answer;
          addMessageToChatbox('OmaOpe: ' + data.question, 'bot-message');
      } 
  })
  
}*/



function addMessageToChatbox(message, className, box) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', className);
    messageElement.textContent = message;
    console.log(messageElement);
    document.getElementById(box).appendChild(messageElement);
    console.log(document.getElementById(box));
    //document.getElementById('chatbox').scrollTop = document.getElementById('chatbox').scrollHeight;
  }
