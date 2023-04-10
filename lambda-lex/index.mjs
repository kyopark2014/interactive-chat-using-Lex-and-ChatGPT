import { LexRuntimeV2Client, RecognizeTextCommand} from "@aws-sdk/client-lex-runtime-v2"; 
//import * as DynamoDB from "@aws-sdk/client-dynamodb";
//const dynamo = new AWS.DynamoDB({ region: "REGION" });
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

// const aws = require('aws-sdk');
const dynamo = new DynamoDBClient();
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

      // store the msgId and response
      const current = new Date();  
      const expirationTime = new Date(current.getTime() + 300); // 5min 

      var dbParams = {
        TableName: tableName,
        Item: {
          msgId: { S: msgId },
          result: { S: data['messages'][0].content},
          ttl: { N: expirationTime } 
        },
      };
      console.log('dbParams: ' + JSON.stringify(dbParams));

      try {
        const data = await dynamo.send(new PutItemCommand(dbParams));
        console.log(data);
      } catch (err) {
        console.error(err);
      }

    /*  dynamo.put
      dynamo.put(dbParams, function (err, data) {
          if (err) {
              console.log('Failure: ' + err);
          }
          else {
              console.log('dynamodb put result: ' + JSON.stringify(data));
          }
      }); */
    } catch (err) {
      console.log("Error responding to message. ", err);

      response = {
        statusCode: 500,
        body: JSON.stringify(err),          
      };
    }
    console.log('response: ', JSON.stringify(response));

    return response;
};
