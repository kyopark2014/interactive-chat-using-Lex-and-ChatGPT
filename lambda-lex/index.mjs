import { LexRuntimeV2Client, RecognizeTextCommand} from "@aws-sdk/client-lex-runtime-v2"; 
import { dynamodb } from "@aws-sdk/dynamo"; 

// const aws = require('aws-sdk');
const dynamo = new dynamodb.DocumentClient();
const tableName = process.env.tableName;

export const handler = async (event) => {  
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env));
    console.log('## EVENT: ' + JSON.stringify(event));

    const text = event.text;
    const msgId = event.msgId;

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
      console.log("response: ", JSON.stringify(data));

      response = {
        statusCode: 200,
        msg: data['messages'][0].content,
      };

      // DynamodB for personalize users
      // DynamodB for personalize users
      var dbParams = {
        TableName: tableName,
        Item: {
            msgId: msgId,
            result: data['messages'][0].content,
        }
      };
      console.log('dbParams: ' + JSON.stringify(dbParams));

      dynamo.put(dbParams, function (err, data) {
          if (err) {
              console.log('Failure: ' + err);
          }
          else {
              console.log('dynamodb put result: ' + JSON.stringify(data));
          }
      });
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
