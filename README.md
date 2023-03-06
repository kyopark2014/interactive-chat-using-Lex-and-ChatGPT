# Amazon Lex와 ChatGPT를 이용한 대화형 챗봇 구현하기

[Amazon Lex](https://aws.amazon.com/ko/lex/)는 애플리케이션에 대화형 인터페이스를 구축하는 서비스로서 어플리케이션이 대화형 인터페이스를 설계, 구축, 테스트, 배포할 수 있도록 자연어 모델을 사용하는 완전관리형 인공지능(Managed AI) 서비스 입니다. 이와같이 Amazon Lex로 만든 챗봇은 연속적인 대화를 주고받을 수 있도록 의도(Intent)를 파악하여, 해당 의도를 이행하는 데 필요한 정보를 사용자에게 표시할 수 있습니다. 하지만, Amazon Lex에서 파악되지 않은 의도에 대한 답변을 위하여, [Amazon Kendra](https://aws.amazon.com/ko/solutions/partners/quantiphi-lex-kendra/)를 사용할 수 있었는데, 2022년 11월에 [ChatGPT](https://openai.com/blog/chatgpt)가 출시되어 우수한 대화능력을 보여줌으로 인해 Lex와의 조화도 고려해 볼 수 있게 되었습니다.


## Chatbot Architecture

여기에서 구현하는 Architecture는 아래와 같습니다. 

![image](https://user-images.githubusercontent.com/52392004/223118356-ff47ed18-de76-403c-ab88-c7583af757bf.png)


단계1: 사용자는 CloudFront의 도메인으로 Chatbot 웹페이지를 시도하면, S3에 저장된 HTML, CSS, Javascript를 로드합니다.

단계2: 웹페이지에서 채팅 메시지를 입력합니다. 이때 "/chat"리소스에 POST Method으로 JSON포맷으로된 text 메시지를 Restful 형태로 요청하게 됩니다.

단계3: [Amazon CloudFront](https://aws.amazon.com/ko/cloudfront/)는 API Gateway로 요청을 전송합니다.

단계4: API Gateway는 /chat 리소스에 연결되어 있는 [AWS Lambda](https://aws.amazon.com/ko/lambda/)를 호출합니다.

단계5: Lambda는 Lex V2 API를 이용하여 채팅 메시지를 Lex에 전달합니다.

단계6: Lex는 미리 정의한 Intent가 있는 경우에 해당하는 동작을 수행합니다. Intent에 없는 메시지가 입력시 ChatGPT로 요청을 보냅니다.

단계7: ChatGPT에서 답변을 하면, 응답이 이전 단계의 역순으로 전달되어서 사용자에게 전달됩니다.

## 대화형 Chatbot의 구현

### ChatGPT API

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

  const intentName = event.interpretations[1].intent.name; // intent name
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

### Lambda를 이용해 Lex로 메시지 전송하기

서울 리전은 Lex V1을 지원하지 않고, Lev V2만을 지원합니다. 따라서, Lex에 사용자의 입력을 메시지로 전송하기 위해서는 Lex V2의 [RecognizeText](https://docs.aws.amazon.com/lexv2/latest/APIReference/API_runtime_RecognizeText.html)을 이용합니다. Lex Runtime V2 client를 아래와 같이 정의합니다. 

```java
import { LexRuntimeV2Client, RecognizeTextCommand} from "@aws-sdk/client-lex-runtime-v2"; 
```

Lambda는 event에서 text를 분리하여 아래와 같이 botAliasId, botId를 이용해 메시지를 전달하게 되며, Lex에서 전달한 응답에서 메시지를 추출하여 전달합니다. 

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



### Client에서 Chat API 활용하기

[chat.js](https://github.com/kyopark2014/ChatGPT/blob/main/html/chat.js)와 같이 Client는 Chat 서버에 RESTful 방식으로 아래와 같이 채팅 메시지를 전송하고 응답이 오면 수신 채팅 버블에 표시 합니다. 여기서 채팅서버의 주소는 CloudFront의 도메인입니다. 

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

CDK 코드 설명


## 직접 실습 해보기

### Cloud9 개발환경 준비하기 

편의상 한국리전에서 Cloud9을 이용해여 배포준비를 합니다. Cloud9은 브라우저에서 코드를 작성, 실행 및 디버깅을 할 수 있는 편리한 환경을 제공합니다. [Cloud9 console](https://ap-northeast-2.console.aws.amazon.com/cloud9control/home?region=ap-northeast-2#/)로 진입하여 [Create environment]를 선택한 후에 아래처럼 Name을 입력합니다. 여기서는 "Chatbot"이라고 입력하였습니다. 이후 나머지는 기본값을 유지하고 [Create]를 선택합니다.

![noname](https://user-images.githubusercontent.com/52392004/222941890-f1615f9b-42cf-4c1c-b5db-bc358ee98ef3.png)

Cloud9이 생성되면 [Open]후 아래처럼 Terminal을 준비합니다. 

![noname](https://user-images.githubusercontent.com/52392004/222941956-65780773-b171-4e12-8b2c-eb76224a735f.png)

### Lex에서 Chatbot의 구현

여기서는 [Amazon Lex 한국어 챗봇 빌드 워크숍](https://github.com/aws-samples/aws-ai-ml-workshop-kr/blob/master/aiservices/lex-korean-workshop/README.md)의 [Hello World 봇](https://github.com/aws-samples/aws-ai-ml-workshop-kr/blob/master/aiservices/lex-korean-workshop/HelloWorldBot.md)을 이용하여 대화형 챗봇의 동작을 설명합니다. 

### CDK로 솔루션 배포하기

아래와 같이 소스를 다운로드합니다.

```java
git clone https://github.com/kyopark2014/interactive-chat-using-Lex-and-ChatGPT
```

cdk 폴더로 이동하여 필요한 라이브러리를 설치합니다. 여기서 aws-cdk-lib은 CDK 2.0 라이브러리입니다.

```java
cd interactive-chat-using-Lex-and-ChatGPT/cdk-chatbot && npm install aws-cdk-lib@2.64.0 path
```

CDK를 처음 사용하는 경우에는 아래와 같이 bootstrap을 실행하여야 합니다. 여기서 account-id은 12자리의 Account Number를 의미합니다. AWS 콘솔화면에서 확인하거나, "aws sts get-caller-identity --query account-id --output text" 명령어로 확인할 수 있습니다.

```java
cdk bootstrap aws://account-id/ap-northeast-2
```

이제 CDK로 전체 인프라를 생성합니다.

```java
cdk deploy
```

정상적으로 설치가 되면 아래와 같은 "Output"이 보여집니다. 여기서 distributionDomainName은 "d3ndv6lhze8yc5.cloudfront.net"이고, WebUrl은 "https://d3ndv6lhze8yc5.cloudfront.net/chat.html"이며, UpdateCommend은 "aws s3 cp ../html/chat.js s3://cdkchatbotstack-chatbotstoragef9db61b9-1mn56n3yu5tn"입니다. 

![noname](https://user-images.githubusercontent.com/52392004/222942854-065a36a8-ee7d-4a92-b7e3-9a5fbaee105d.png)


"html/chat.js"를 열어서, 아래와 같이 url 주소를 업데이트합니다. 여기에서는 도메인 이름으로 distributionDomainName인 "d3ndv6lhze8yc5.cloudfront.net"을 입력합니다.

![noname](https://user-images.githubusercontent.com/52392004/222943096-11918479-ba6c-4605-aea8-f92eb729367e.png)


이제 수정한 chat.js 파일을 아래와 같이 S3 bucket에 복사합니다. 이때의 명령어는 UpdateCommend를 참고합니다.

```java
aws s3 cp ../html/chat.js s3://cdkchatbotstack-chatbotstoragef9db61b9-1mn56n3yu5tn
```

이제 WebUrl인 ""https://d3ndv6lhze8yc5.cloudfront.net/chat.html"로 접속합니다. 


### 실행하기 


![noname](https://user-images.githubusercontent.com/52392004/223114419-3680ebbb-8e69-4805-8b01-1eae5c1f271a.png)




## 리소스 정리하기 

더이상 인프라를 사용하지 않는 경우에 아래처럼 모든 리소스를 삭제할 수 있습니다. 

```java
cdk destroy
```
