import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export const handler = async (event) => {  
  console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env));
  console.log('## EVENT: ' + JSON.stringify(event));

  const models = ['text-davinci-003','code-davinci-002'];
  const frequency_penalty = 0.5;
  const max_tokens = 2000;
  const presence_penalty = 0.1;
  const temperature = 0;
  const top_p = 1;
  const model_name = models[0];
  const prompt = event.text;
  console.log('prompt: ' + prompt);

  let isCompleted = false;    
  let response;
  try {
    const params = {
      model: model_name,
      prompt: prompt,
      temperature: temperature, 
      max_tokens: max_tokens, 
      top_p: top_p, 
      frequency_penalty: frequency_penalty,
      presence_penalty: presence_penalty, 
    };
    console.log('params: ', params);
    
    const result = await openai.createCompletion(params);
    console.log('result: ', result.data);
    console.log('id: ', result.data.id);
    
    const choices = result.data.choices;
    console.log('msg: ', choices[0].text);
    
    isCompleted = true;    

    response = {
      statusCode: 200,
      id: result.data.id,
      msg: choices[0].text,
    };
  } catch (error) {
    console.log('error: ', error);
    isCompleted = true;    

    response = {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }

  function wait(){
    return new Promise((resolve, reject) => {
      if(!isCompleted) {
        setTimeout(() => resolve("wait..."), 1000)
      }
      else {
        setTimeout(() => resolve("closing..."), 0)
      }
    });
  }
  console.log(await wait());
  console.log(await wait());
  console.log(await wait());
  console.log(await wait());

  return response;
};