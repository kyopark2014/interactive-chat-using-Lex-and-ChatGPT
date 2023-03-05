import fetch from 'node-fetch';

const apiKey = process.env.OPENAI_API_KEY

export const handler = async (event) => {  
  console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env));
  console.log('## EVENT: ' + JSON.stringify(event));

  const prompt = event.text;
  console.log('prompt: ', prompt);

  let response;
  try {
    let msg = "";
    const res = await fetch('https://api.openai.com/v1/chat/completions',{
      method: "POST",
      headers: {
        "Authorization": "Bearer "+apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "model": "gpt-3.5-turbo",
        "messages": [
          {"role": "user", "content": prompt},
        ],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log("output: ", data.choices[0]);

      msg = data.choices[0].message.content;
      console.log("msg: "+ msg);
      
      response = {
        statusCode: 200,
        msg: msg
      };
    }
    else {
      console.log(res);
      
      response = {
        statusCode: 500,
        body: JSON.stringify(res)
      };
    }

  } catch (error) {
    console.log('error: ', error);

    response = {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }

  return response;
};

