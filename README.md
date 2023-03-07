# Amazon Lex와 ChatGPT를 이용한 대화형 Chatbot 구현하기

[Amazon Lex](https://aws.amazon.com/ko/lex/)는 애플리케이션에 대화형 인터페이스를 설계, 구축, 테스트, 배포할 수 있도록 자연어 모델을 사용하는 완전관리형 인공지능(Managed AI) 서비스 입니다. 이와같이 Amazon Lex로 만든 chatbot은 연속적인 대화를 주고 받을 수 있도록 의도(intent)를 파악하여, 해당 의도를 이행하는 데 필요한 정보를 사용자에게 표시할 수 있습니다. 또한, Amazon Lex에서 파악되지 않은 의도에 대한 답변을 위하여, [Amazon Kendra](https://aws.amazon.com/ko/solutions/partners/quantiphi-lex-kendra/)를 사용할 수 있습니다. 2022년 11월에 [ChatGPT](https://openai.com/blog/chatgpt)가 출시되어 우수한 대화 능력을 보여줌으로 인해, Kendra 뿐 아니라 ChatGPT를 사용하는것도 가능해졌습니다. 본 게시글에서는 ChatGPT를 이용하여 미리 정의되지 않은 의도(intent)에 답변을 할 수 있는 대화형 chatbot을 구현하는 방법을 설명하고자 합니다. 

## Chatbot Architecture

여기에서 구현하는 Architecture는 아래와 같습니다. [Amazon CloudFront](https://aws.amazon.com/ko/cloudfront/)를 이용하여 채팅을 위한 웹페이지를 제공합니다. 사용자가 입력한 채팅 메시지는 [Amazon API Gateway](https://aws.amazon.com/ko/api-gateway/)와 [AWS Lambda](https://aws.amazon.com/ko/lambda/)를 이용해 Lex에서 의도(intent)를 파악후 답변을 합니다. 그런데, Lex에서 인식되지 못한 의도가 있다면 Lambda 함수를 이용하여 ChatGPT에 질의를 하고, 그 결과를 채팅창에 표시하게 됩니다. 이러한 대화형 Chatbot을 구성하기 위한 인프라는 [AWS CDK](https://aws.amazon.com/ko/cdk/)를 이용해 생성 및 관리됩니다. 모든 인프라는 [서버리스(Serverless)](https://aws.amazon.com/ko/serverless/)로 구성되므로 유지보수면에서 효율적이며 변동하는 트래픽에도 자동 확장(Auto Scaling)을 통해 안정적으로 시스템을 운용할 수 있습니다.

![image](https://user-images.githubusercontent.com/52392004/223118356-ff47ed18-de76-403c-ab88-c7583af757bf.png)

상세한 동작은 아래를 참조합니다. 

단계1: 사용자는 CloudFront의 도메인으로 Chatbot 웹페이지를 시도하면, S3에 저장된 HTML, CSS, Javascript를 로드합니다.

단계2: 웹페이지에서 채팅 메시지를 입력합니다. 이때 "/chat"리소스에 POST Method으로 JSON포맷으로된 text 메시지를 RESTful 형태로 요청하게 됩니다.

단계3: CloudFront는 API Gateway로 요청을 전송합니다.

단계4: API Gateway는 /chat 리소스에 연결되어 있는 Lambda 함수를 호출합니다.

단계5: Lambda 함수는 Lex V2 API를 이용하여 채팅 메시지를 Lex에 전달합니다.

단계6: Lex는 미리 정의한 의도(intent)가 있는 경우에 해당하는 동작을 수행합니다. 의도를 인식할 수 없는 메시지라면, ChatGPT로 문의하는 요청을 보냅니다.

단계7: ChatGPT에서 답변을 하면, 응답이 이전 단계의 역순으로 전달되어서 사용자에게 전달됩니다.

## 대화형 Chatbot의 구현

### Lambda 함수를 이용해 Lex로 메시지 전송하기

서울 리전은 Lex V1을 지원하지 않고, Lev V2만을 지원합니다. 따라서, Lex에 사용자의 입력을 메시지로 전송하기 위해서는 Lex V2의 [RecognizeText](https://docs.aws.amazon.com/lexv2/latest/APIReference/API_runtime_RecognizeText.html)을 이용합니다. Lex Runtime V2 client를 아래와 같이 정의합니다. 

```java
import { LexRuntimeV2Client, RecognizeTextCommand} from "@aws-sdk/client-lex-runtime-v2"; 
```

Lambda 함수는 event에서 text를 분리하여 아래와 같이 botAliasId, botId를 이용해 메시지를 전달하게 되며, Lex에서 전달한 응답에서 메시지를 추출하여 전달합니다. 

```java
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

const data = await lexClient.send(command);

return {
  statusCode: 200,
  msg: data['messages'][0].content,
};
```


### Lambda 함수를 이용해 ChatGPT API를 이용하기

[2023년 3월에 ChatGPT의 공식 오픈 API](https://openai.com/blog/introducing-chatgpt-and-whisper-apis)가 공개되었습니다. 새로운 API의 경로는  "/v1/chat/completions"이며, "gpt-3.5-turbo" 모델을 사용합니다. 이 모델은 기존 모델인 "text-davinci-003"에 비하여, 90% 낮은 비용으로 활용할 수 있으나 ChatGPT에서 날씨를 검색한거나 하는 작업은 할 수 없습니다. 여기서는 ChatGPT 공식 API와 함께 채팅중 검색을 지원하는 "text-davinci-003" 모델을 사용하는 방법을 설명합니다.

#### gpt-3.5-turbo 모델 사용하기 

[OpenAI가 제공하는 ChatGPT API](https://platform.openai.com/docs/api-reference/chat)인 "v1/chat/completions"로 HTTPS POST로 요청을 수행합니다. 이를 위해 여기서는 [fetch](https://www.npmjs.com/package/node-fetch)를 사용합니다. 이때 ChatGPT에 전달하는 요청의 header에는 아래와 같이 Authorization과 Content-Type을 포함하여야 합니다. Authorization에 필요한 API Key는 [OpenAI: API Key](https://platform.openai.com/account/api-keys)에서 발급받아서 환경변수로 저장하여 사용합니다. 메시지 요청시 role은 [ChatGPT API Transition Guide](https://help.openai.com/en/articles/7042661-chatgpt-api-transition-guide)에 따라 "user", "system", "assistant"로 지정할 수 있습니다. 상세 코드는 [여기(index.mjs)](https://github.com/kyopark2014/interactive-chat-using-Lex-and-ChatGPT/blob/main/lambda-chatgpt/index.mjs)에서 확인할 수 있습니다. 

```java
import fetch from 'node-fetch';

const apiKey = process.env.OPENAI_API_KEY

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
```

ChatGPT가 보내온 응답 메시지를 꺼내서, Lex에 보낼때에는 아래의 포맷으로 전송하여야 합니다. 이때 sessionState에는 dialogAction, intent가 포함하여야 하며, intent name을 입력(event)에서 추출하여 넣어주어야 합니다. 또한 ChatGPT의 응답메시지는 "messages"의 "content"에 넣어서 아래처럼 전달합니다. 

```java
if (res.ok) {
  const data = await res.json();
  console.log("output: ", data.choices[0]);

  msg = '[ChatGPT] '+data.choices[0].message.content;
  console.log("msg: "+ msg);

  const intentName = event.interpretations[0].intent.name; // intent name
  response = {
    "sessionState": {
      "dialogAction": {
        "type": "Close"
      },
      "intent": {
        "confirmationState": "Confirmed",
        "name": intentName,
        "state": "Fulfilled",            
      },          
    },
    "messages": [
      {
        "contentType": "PlainText",
        "content": msg,            
      }
    ]
  }
} 
```

<!--
```java
{
    "$metadata": {
        "httpStatusCode": 200,
        "requestId": "80c4c62f-06bd-4b14-9369-67d70450c48f",
        "attempts": 1,
        "totalRetryDelay": 0
    },
    "interpretations": [
        {
            "intent": {
                "confirmationState": "Confirmed",
                "name": "HelloWorld",
                "slots": {
                    "Name": {
                        "value": {
                            "interpretedValue": "홍길동",
                            "originalValue": "홍길동",
                            "resolvedValues": []
                        }
                    }
                },
                "state": "Fulfilled"
            },
            "nluConfidence": {
                "score": 1
            }
        },
        {
            "intent": {
                "name": "FallbackIntent",
                "slots": {}
            }
        }
    ],
    "messages": [
        {
            "content": "반갑습니다. 홍길동님.",
            "contentType": "PlainText"
        },
        {
            "content": "HelloWorld 의도를 종료합니다.",
            "contentType": "PlainText"
        }
    ],
    "requestAttributes": {},
    "sessionId": "mysession-01",
    "sessionState": {
        "dialogAction": {
            "type": "Close"
        },
        "intent": {
            "confirmationState": "Confirmed",
            "name": "HelloWorld",
            "slots": {
                "Name": {
                    "value": {
                        "interpretedValue": "홍길동",
                        "originalValue": "홍길동",
                        "resolvedValues": []
                    }
                }
            },
            "state": "Fulfilled"
        },
        "originatingRequestId": "86123704-a4f7-49d9-bc4e-4a4f247e045e",
        "sessionAttributes": {}
    }
}
```
-->

#### text-davinci-003 모델 사용하기 

"text-davinci-003" 모델은 [Completion API](https://platform.openai.com/docs/api-reference/completions)에 따라 "v1/completions"을 사용합니다. 여기서는 [OpenAI Node.js Library](https://www.npmjs.com/package/openai)을 이용해 구현합니다. 상세 코드는 [여기(index-davinch.mjs)](https://github.com/kyopark2014/interactive-chat-using-Lex-and-ChatGPT/blob/main/lambda-chatgpt/index-davinch.mjs)에서 확인할 수 있습니다. 

```java
import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const models = ['text-davinci-003','code-davinci-002'];
const frequency_penalty = 0.5;
const max_tokens = 2000;
const presence_penalty = 0.1;
const temperature = 0;
const top_p = 1;
const model_name = models[0];
const prompt = event.text;

const params = {
  model: model_name,
  prompt: prompt,
  temperature: temperature, 
  max_tokens: max_tokens, 
  top_p: top_p, 
  frequency_penalty: frequency_penalty,
  presence_penalty: presence_penalty, 
};

const result = await openai.createCompletion(params);
const choices = result.data.choices;
return {
  statusCode: 200,
  id: result.data.id,
  msg: choices[0].text,
};    
```



### Client에서 Chat API 활용하기

Client는 Chat 서버에 RESTful 방식으로 아래와 같이 채팅 메시지를 전송하고 응답이 오면 수신 채팅 버블에 표시 합니다. 여기서 채팅서버의 주소는 CloudFront의 도메인입니다. 상세코드는 [여기(chat.js)](https://github.com/kyopark2014/ChatGPT/blob/main/html/chat.js)에서 확인합니다.

```java
function sendRequest(text) {
    const uri = "https://dre57i7noiw1a.cloudfront.net/chat";
    const xhr = new XMLHttpRequest();

    xhr.open("POST", uri, true);
    xhr.onreadystatechange = () => {
        if (xhr.readyState === 4 && xhr.status === 200) {
            response = JSON.parse(xhr.responseText);
            console.log("response: " + JSON.stringify(response));
            
            addReceivedMessage(response.msg)
        }
    };

    var requestObj = {"text":text}
    console.log("request: " + JSON.stringify(requestObj));

    var blob = new Blob([JSON.stringify(requestObj)], {type: 'application/json'});

    xhr.send(blob);            
}
```

## AWS CDK로 리소스 생성 준비

여기서는 typescript를 이용하여 AWS CDK를 구성합니다. 상세 코드는 [여기(cdk-chatbot-stack.ts)](https://github.com/kyopark2014/interactive-chat-using-Lex-and-ChatGPT/blob/main/cdk-chatbot/lib/cdk-chatbot-stack.ts)에서 확인할 수 있습니다. 

Lex에 대한 Lambda 함수는 아래와 같이 정의합니다. environment에 botId, botAliasId를 포함하여야 합니다. 여기서는 한국어로 된 chatbot을 이용하므로 아래와 같이 localeId로 "ko_KR"를 지정합니다. 이 Lambda 함수는 Lex와 API Gateway에 대한 퍼미션을 가져야 합니다. 

```java
// Lambda for lex
const lambdaLex = new lambda.Function(this, 'lambda-function-lex', {
  description: 'lambda for chat',
  functionName: 'lambda-function-lex',
  handler: 'index.handler',
  runtime: lambda.Runtime.NODEJS_18_X,
  code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-lex')),
  timeout: cdk.Duration.seconds(120),
  environment: {
    botId: "BSZQXD0ABN",
    botAliasId: "TSTALIASID",
    localeId: "ko_KR", // en_US
    sessionId: "mysession-01",
  }
});     
const lexPolicy = new iam.PolicyStatement({  
  actions: ['lex:*'],
  resources: ['*'],
});
lambdaLex.role?.attachInlinePolicy(
  new iam.Policy(this, 'rekognition-policy', {
    statements: [lexPolicy],
  }),
);
// permission for api Gateway
lambdaLex.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));    
```

Lex의 입력은 API Gateway를 이용하여 아래와 같이 "/chat" 리소스로 POST method를 통해 받게 설정합니다. 

```java
const api = new apiGateway.RestApi(this, 'api-chatbot', {
  description: 'API Gateway for chatbot',
  endpointTypes: [apiGateway.EndpointType.REGIONAL],
  deployOptions: {
    stageName: stage,
  },
});  

const chat = api.root.addResource('chat');
chat.addMethod('POST', new apiGateway.LambdaIntegration(lambdaLex, {
  passthroughBehavior: apiGateway.PassthroughBehavior.WHEN_NO_TEMPLATES,
  credentialsRole: role,
  integrationResponses: [{
    statusCode: '200',
  }], 
  proxy:false, 
}), {
  methodResponses: [   
    {
      statusCode: '200',
      responseModels: {
        'application/json': apiGateway.Model.EMPTY_MODEL,
      }, 
    }
  ]
}); 
```

[CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)를 우회하기 위하여 CloudFront에 아래와 같이 "/chat" 리소스에 대한 behavior를 등록합니다. 

```java
distribution.addBehavior("/chat", new origins.RestApiOrigin(api), {
  cachePolicy: cloudFront.CachePolicy.CACHING_DISABLED,
  allowedMethods: cloudFront.AllowedMethods.ALLOW_ALL,  
  viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
});
```

ChatGPT에 텍스트를 전송하여 응답을 받는 Lambda 함수를 아래와 같이 준비합니다. 여기서 OPENAI_API_KEY는 OpenAI에서 발급받은 API Key 입니다. 

```java
const lambdachat = new lambda.Function(this, 'lambda-chatgpt', {
  description: 'lambda for chatgpt',
  functionName: 'lambda-chatgpt',
  handler: 'index.handler',
  runtime: lambda.Runtime.NODEJS_18_X,
  code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-chatgpt')),
  timeout: cdk.Duration.seconds(120),
  environment: {
    OPENAI_API_KEY: "123456",
  }
});   
```

## 직접 실습 해보기

### Cloud9 개발환경 준비하기 

편의상 한국리전에서 Cloud9을 이용해여 배포준비를 합니다. Cloud9은 브라우저에서 코드를 작성, 실행 및 디버깅을 할 수 있는 편리한 환경을 제공합니다. [Cloud9 console](https://ap-northeast-2.console.aws.amazon.com/cloud9control/home?region=ap-northeast-2#/)로 진입하여 [Create environment]를 선택한 후에 아래처럼 Name을 입력합니다. 여기서는 "Chatbot"이라고 입력하였습니다. 이후 나머지는 기본값을 유지하고 [Create]를 선택합니다.

![noname](https://user-images.githubusercontent.com/52392004/222941890-f1615f9b-42cf-4c1c-b5db-bc358ee98ef3.png)

Cloud9이 생성되면 [Open]후 아래처럼 Terminal을 준비합니다. 

![noname](https://user-images.githubusercontent.com/52392004/222941956-65780773-b171-4e12-8b2c-eb76224a735f.png)


### 전체 코드 다운로드 및 CDK 배포 준비

아래와 같이 소스를 다운로드합니다.

```java
git clone https://github.com/kyopark2014/interactive-chat-using-Lex-and-ChatGPT
```

CDK 폴더로 이동하여 필요한 라이브러리를 설치합니다. 여기서 aws-cdk-lib은 CDK 2.0 라이브러리입니다.

```java
cd interactive-chat-using-Lex-and-ChatGPT/cdk-chatbot && npm install aws-cdk-lib@2.64.0 path
```

CDK를 처음 사용하는 경우에는 아래와 같이 bootstrap을 실행하여야 합니다. 여기서 account-id은 12자리의 Account Number를 의미합니다. AWS 콘솔화면에서 확인하거나, "aws sts get-caller-identity --query account-id --output text" 명령어로 확인할 수 있습니다.

```java
cdk bootstrap aws://account-id/ap-northeast-2
```

### Lex에서 Chatbot의 구현

[Amazon Lex 한국어 챗봇 빌드 워크숍](https://github.com/aws-samples/aws-ai-ml-workshop-kr/blob/master/aiservices/lex-korean-workshop/README.md)의 [Hello World Bot](https://github.com/aws-samples/aws-ai-ml-workshop-kr/blob/master/aiservices/lex-korean-workshop/HelloWorldBot.md)에 따라 HelloWorld Bot을 생성합니다. "Hello World Bot"은 "안녕"이라고 입력하면, 이름을 물어보고 확인하는 간단한 인사봇입니다. 

"Hello World Bot" 생성을 완료한 후에, [Bot Console](https://ap-northeast-2.console.aws.amazon.com/lexv2/home?region=ap-northeast-2#bots)에 접속해서 "HelloWorldBot"을 선택합니다. 아래와 같이 botId는 "BSZQXD0ABN"임을 알수 있습니다. 

![noname](https://user-images.githubusercontent.com/52392004/223062399-20861e92-0afb-43b6-bb33-8b10c8f2cee8.png)

"HelloWorldBot"의 [Aliases]를 선택하면 아래와 같이 Aliases를 알 수 있습니다. 여기서는 "TestBotAlias"를 선택합니다. 

![noname](https://user-images.githubusercontent.com/52392004/223062755-28f9f6dc-0e25-4117-9c75-4cea2221e9d5.png)

아래와 같이 botAliasId가 "TSTALIASID"임을 알 수 있습니다.

![noname](https://user-images.githubusercontent.com/52392004/223063139-8b3c78df-fdf0-45b3-ba24-55b1ef33b8c4.png)

### 환경변수 업데이트

Cloud9으로 돌아가서 왼쪽 파일 탐색기에서 "interactive-chat-using-Lex-and-ChatGPT/cdk-lex/lib/cdk-lex-stack.ts"을 열어서 "Lambda for lex"의 Environment의 botId, botAliasId, localeId를 업데이트 합니다. 

![noname](https://user-images.githubusercontent.com/52392004/223222609-e2dae835-66cb-4ae2-a3f8-d094c4afe6f4.png)

또한, "Lambda for chatgpt"의 environment에서 "OPENAI_API_KEY"을 입력합니다. 미리 받은 Key가 없다면 [OpenAI: API Key](https://platform.openai.com/account/api-keys)에서 발급받아서 입력합니다. 

![noname](https://user-images.githubusercontent.com/52392004/223222868-3e53dbce-fae1-4255-bde8-fd3b9d60d663.png)




### 배포하기 

이제 CDK로 전체 인프라를 생성합니다.

```java
cdk deploy
```

정상적으로 설치가 되면 아래와 같은 "Output"이 보여집니다. 여기서 distributionDomainName은 "d3ndv6lhze8yc5.cloudfront.net"이고, WebUrl은 "https://d3ndv6lhze8yc5.cloudfront.net/chat.html"이며, UpdateCommend은 "aws s3 cp ../html/chat.js s3://cdkchatbotstack-chatbotstoragef9db61b9-1mn56n3yu5tn"입니다. 

![noname](https://user-images.githubusercontent.com/52392004/222942854-065a36a8-ee7d-4a92-b7e3-9a5fbaee105d.png)


### HTML의 Javascript의 도메인 주소 업데이트하기

"html/chat.js"를 열어서, 아래와 같이 url 주소를 업데이트합니다. 여기에서는 도메인 이름으로 distributionDomainName인 "d3ndv6lhze8yc5.cloudfront.net"을 입력합니다.

![noname](https://user-images.githubusercontent.com/52392004/222943096-11918479-ba6c-4605-aea8-f92eb729367e.png)


이제 수정한 chat.js 파일을 아래와 같이 S3 bucket에 복사합니다. 이때의 명령어는 UpdateCommend를 참고합니다.

```java
aws s3 cp ../html/chat.js s3://cdkchatbotstack-chatbotstoragef9db61b9-1mn56n3yu5tn
```

### Lex에서 Lambda 함수로 ChatGPT를 호출하도록 설정하기

[AWS Lex Console](https://ap-northeast-2.console.aws.amazon.com/lexv2/home?region=ap-northeast-2#bots)에서 "HellowWorldBot"을 선택하여 "Aliases"에서 [Languages]를 선택하여 아래처럼 [Korean(South Korea)]를 선택합니다.

![noname](https://user-images.githubusercontent.com/52392004/223216750-ceebc59e-dacc-4626-81c1-9a58f9b2a5b5.png)

아래처럼 [Souce]로 "lambda-chatgpt"를 선택하고, [Lambda function version or alias]은 "$LATEST"를 선택하고, [Save]를 선택합니다.

![noname](https://user-images.githubusercontent.com/52392004/223217113-5605aff4-f84f-4c7d-8d6b-17056460a5d8.png)

이후 "HellowWorldBot"의 [Intents]에서 아래처럼 [FallbackIntent]를 선택합니다. 

![noname](https://user-images.githubusercontent.com/52392004/223212743-056c3f3e-16b1-4590-b60e-fd30376fe2b0.png)

이후 아래로 스크롤하여 Fulfillment에서 [Advanced options]를 선택한 후, 아래 팝업의 [Use a Lambda function for fulfillment]을 Enable 합니다. 

![noname](https://user-images.githubusercontent.com/52392004/223218985-23b87c1a-4020-4996-a63f-df082743b35d.png)

화면 상단의 [Build]를 선택하여 변경된 내용을 적용합니다.

![noname](https://user-images.githubusercontent.com/52392004/223218223-c35fd42f-c75b-445c-aecf-4503aea09ce5.png)


### 실행하기 

WebUrl의 ""https://d3ndv6lhze8yc5.cloudfront.net/chat.html" 으로 브라우저에서 채팅화면으로 접속합니다. 아래와 같이 웹브라우저에서 Lex와 채팅을 할 수 있습니다. 아래의 첫 입력은 "HelloWorld" Bot에 있는 이름을 확인하는 Intent 동작입니다. 이후 나오는 질문인 "Lex에 대해 설명해줘"는 "HelloWorld" Bot에 의도(intent)로 등록되지 않은 질문이므로 ChatGPT에 문의하여 아래와 같은 결과를 사용자에게 보여줄 수 있었습니다. 

![noname](https://user-images.githubusercontent.com/52392004/223114419-3680ebbb-8e69-4805-8b01-1eae5c1f271a.png)


## 리소스 정리하기 

더이상 인프라를 사용하지 않는 경우에 아래처럼 모든 리소스를 삭제할 수 있습니다. 

```java
cdk destroy
```

## 결론

Amazon Lex와 ChatGPT를 이용하여 대화형 Chatbot을 구현하였고 인프라를 효과적으로 개발 및 운용할 수 있도록 AWS CDK를 이용하는 방법을 설명하였습니다. ChatGPT를 이용함으로써 Lex에서 인식되지 못한 의도(intent)에도 적절한 응답을 사용자에게 줄수 있어서 사용성을 개선할 수 있습니다. ChatGPT는 이미 우수한 대화능력을 증명하였고, 현재 다양한 GPT 모델들이 발표되고 있습니다. 따라서 이러한 인공지능 모델을 Lex와 같은 Chatbot 서비스에 도입함으로써 사용자의 사용성을 개선하고 더 좋은 서비스를 제공할 수 있을것으로 기대됩니다. 


