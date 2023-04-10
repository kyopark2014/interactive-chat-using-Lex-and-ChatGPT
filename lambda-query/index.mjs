import { LexRuntimeV2Client, RecognizeTextCommand} from "@aws-sdk/client-lex-runtime-v2"; 
//import * as DynamoDB from "@aws-sdk/client-dynamodb";
//const dynamo = new AWS.DynamoDB({ region: "REGION" });
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

// const aws = require('aws-sdk');
const dynamo = new DynamoDBClient();
const tableName = process.env.tableName;

export const handler = async (event) => {  
    console.log('## ENVIRONMENT VARIABLES: ' + JSON.stringify(process.env));
    console.log('## EVENT: ' + JSON.stringify(event));

    const msgId = event.msgId;

    let response = "";
    try {      
        var dbParams = {
            TableName: tableName,
            Key: {
                msgId: { S: msgId },
            },
        };
        console.log('dbParams: ' + JSON.stringify(dbParams));

        const data = await dynamo.send(new GetItemCommand(dbParams));
        console.log('data: ', data);
        
        let result = data.Item.result.S;
        console.log('result: ', result);

        response = {
            statusCode: 200,
            body: result,          
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
};
