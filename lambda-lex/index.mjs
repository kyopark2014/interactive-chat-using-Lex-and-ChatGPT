import { LexRuntimeV2Client, RecognizeTextCommand} from "@aws-sdk/client-lex-runtime-v2"; 
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient();
const tableName = process.env.tableName;

export const handler = async (event) => {  
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env));
    console.log('## EVENT: ' + JSON.stringify(event));

    const text = event.text;
    const msgId = event.msgId;
    let isCompleted = false;

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
      let date = new Date();
      const expirationTime = date.getTime()+300;

      var dbParams = {
        TableName: tableName,
        Item: {
          msgId: { S: msgId },
          result: { S: data['messages'][0].content},
          ttl: { N: '' +expirationTime } 
        },
      };
      console.log('dbParams: ' + JSON.stringify(dbParams));

      try {
        const data = await dynamo.send(new PutItemCommand(dbParams));
        console.log(data);
        
        isCompleted = true;
      } catch (err) {
        console.error(err);
      }
    } catch (err) {
      console.log("Error responding to message. ", err);

      response = {
        statusCode: 500,
        body: JSON.stringify(err),          
      };
    }
    console.log('response: ', JSON.stringify(response));
    
    function wait() {
        return new Promise((resolve, reject) => {
            if (!isCompleted) {
                setTimeout(() => resolve("wait..."), 1000);
            }
            else {
                setTimeout(() => resolve("done..."), 0);
            }
        });
    }
    console.log(await wait());
    console.log(await wait());
    console.log(await wait());
    console.log(await wait());
    console.log(await wait());

    return response;
};
