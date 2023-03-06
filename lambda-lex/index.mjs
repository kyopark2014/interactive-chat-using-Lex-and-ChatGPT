
import { LexRuntimeV2Client, RecognizeTextCommand} from "@aws-sdk/client-lex-runtime-v2"; 

export const handler = async (event) => {  
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env));
    console.log('## EVENT: ' + JSON.stringify(event));

    const text = event.text;

    let lexParams = {        
        botAliasId: process.env.botAliasId,
        botId: process.env.botId,
        localeId: process.env.localeId,
        text: text,
        sessionId: process.env.sessionId,
    };
    
    const lexClient = new LexRuntimeV2Client();
    const command = new RecognizeTextCommand(lexParams);

    let response = "";
    try {
      const data = await lexClient.send(command);
      // console.log("response: ", JSON.stringify(data['messages']));
      console.log("response: ", JSON.stringify(data));

      let sender = "";
      let msg = "";      
      if(data['messages']) {
        sender = 'Lex',
        msg = data['messages'][0].content;
      }
      else {
        sender = JSON.parse(data).sender;
        msg = JSON.parse(data).msg;
      }
      console.log('sender: ', sender);
      console.log('msg: ', msg);

      response = {
        statusCode: 200,
        sender: sender,
        msg: msg,
      };
    } catch (err) {
      console.log("Error responding to message. ", err);

      response = {
        statusCode: 500,
        body: JSON.stringify(err),          
      };
    }
    console.log('response: ', JSON.stringify(response));

    return response;
}