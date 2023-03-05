# Amazon Lex와 ChatGPT를 이용한 Interactive Chat 구현하기

Amazon Lex는 애플리케이션에 대화형 인터페이스를 구축하는 서비스로서 어플리케이션이 대화형 인터페이스를 설계, 구축, 테스트, 배포할 수 있도록 자연어 모델을 사용하는 완전관리형 인공지능(Managed AI) 서비스 입니다. 이와같이 Amazon Lex로 만든 챗봇은 연속적인 대화를 주고받을 수 있도록 의도(Intent)를 파악하여, 해당 의도를 이행하는 데 필요한 정보를 사용자에게 표시할 수 있습니다. 하지만, Amazon Lex에서 파악되지 않은 의도에 대한 답변을 위하여, [Amazon Kendra](https://aws.amazon.com/ko/solutions/partners/quantiphi-lex-kendra/)를 사용할 수 있었는데, 2022년 11월에 [ChatGPT](https://openai.com/blog/chatgpt)가 출시되어 우수한 대화능력을 보여줌으로 인해 Lex와의 조화도 고려해 볼 수 있게 되었습니다.

여기에서 구현하는 Architecture는 아래와 같습니다. 

![image](https://user-images.githubusercontent.com/52392004/222934173-26d5bbf7-ade3-4293-b4de-5c1e99ff3d1e.png)

## Aamazon Lex의 구현


### Lex에서 Chatbot의 구현


### Lambda를 이용해 Lex로 메시지 전송하기

서울 리전은 Lex V1을 지원하지 않으므로, Lev V2를 이용하여야 합니다. Lex에 사용자의 입력을 메시지로 전송하기 위하여 Lex V2에서는 [RecognizeText](https://docs.aws.amazon.com/lexv2/latest/APIReference/API_runtime_RecognizeText.html)을 이용하므로, Lex Runtime V2 client를 아래와 같이 정의 합니다. 

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
const messages = data['messages'][0];
console.log('text: ', messages.content);

return {
  statusCode: 200,
  body: messages.content,
};
```


### Lambda를 이용해 ChatGPT에 요청하기 

[2023년 3월에 ChatGPT API가 오픈](https://openai.com/blog/introducing-chatgpt-and-whisper-apis)되어서 Lex와 연동할 수 있게 되었습니다. 새로운 API의 경로는  "/v1/chat/completions"이며, "gpt-3.5-turbo" 모델을 사용합니다. 이 모델은 기존 모델인 "text-davinci-003"에 비하여, 90% 낮은 비용으로 활용할 수 있으나 ChatGPT에서 날씨를 검색한거나 하는 작업은 할 수 없습니다. 

#### gpt-3.5-turbo 모델 사용하기 

[OpenAI가 제공하는 ChatGPT API](https://platform.openai.com/docs/api-reference/chat)인 "v1/chat/completions"로 HTTPS POST로 요청을 수행합니다. 이를 위해 여기서는 [fetch](https://www.npmjs.com/package/node-fetch)를 사용합니다. 이때 ChatGPT에 전달하는 요청의 header에는 아래와 같이 Authorization과 Content-Type을 포함하여야 합니다. Authorization에 필요한 API Key는 [OpenAI: API Key](https://platform.openai.com/account/api-keys)에서 발급받아서 환경변수로 저장하여 사용합니다. 메시지 요청시 role은 [ChatGPT API Transition Guide](https://help.openai.com/en/articles/7042661-chatgpt-api-transition-guide)에 따라 "user", "system", "assistant"로 지정할 수 있습니다.

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

if (res.ok) {
  const data = await res.json();
  console.log("output: ", data.choices[0]);

  msg = data.choices[0].message.content;
  console.log("msg: "+ msg);
      
  return {
    statusCode: 200,
    msg: msg
  };    
}
```


#### text-davinci-003 모델 사용하기 

"text-davinci-003" 모델은 [Completion API](https://platform.openai.com/docs/api-reference/completions)에 따라 "v1/completions"을 사용합니다. 여기서는 [OpenAI Node.js Library](https://www.npmjs.com/package/openai)을 이용해 구현합니다. 

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

## AWS CDK로 리소스 생성 코드 준비



## 직접 실습 해보기

### Cloud9 생성

AWS Cloud9을 활용하면 브라우저만으로 코드를 작성, 실행 및 디버깅을 쉽게 할 수 있으며, 배포(Deployment)를 위한 편리한 환경을 생성할 수 있습니다. 여기서는 편의상 한국리전을 사용하여 Cloud9 으로 인프라를 생성합니다.

[Cloud9 console](https://ap-northeast-2.console.aws.amazon.com/cloud9control/home?region=ap-northeast-2#/)로 진입하여 [Create environment]를 선택한 후에 아래처럼 Name을 입력합니다. 여기서는 "Storytime"이라고 입력하였습니다. 이후 나머지는 기본값을 유지하고 [Create]를 선택합니다.


![noname](https://user-images.githubusercontent.com/52392004/219947047-51cd8be9-c3c1-4d69-9322-b6af1d5b335b.png)

Cloud9이 생성되면 [Open]후 아래처럼 Terminal을 준비합니다. 

![noname](https://user-images.githubusercontent.com/52392004/219947426-13156f52-4e08-437d-87d1-6ff0302a3d95.png)

### CDK로 솔루션 배포하기

아래와 같이 소스를 다운로드합니다.

```java
git clone https://github.com/kyopark2014/simple-serverless-storytime
```

"cdk-storytime/lib/cdk-storytime-stack.ts"을 열어서, email 주소를 업데이트 합니다.

![noname](https://user-images.githubusercontent.com/52392004/219948651-c724d298-aac6-427c-b072-5ed6edea6fcb.png)


터미널로 돌아가서, CDK 폴더로 이동한 후에 CDK v2.64.0을 설치합니다.

```java
cd simple-serverless-storytime/cdk-storytime && npm install aws-cdk-lib@2.64.0
```

CDK를 처음 사용하는 경우에는 아래와 같이 bootstrap을 실행하여야 합니다. 여기서 account-id은 12자리의 Account Number를 의미합니다. AWS 콘솔화면에서 확인하거나, "aws sts get-caller-identity --query account-id --output text" 명령어로 확인할 수 있습니다.

```java
cdk bootstrap aws://account-id/ap-northeast-2
```

이제 CDK로 전체 인프라를 생성합니다.

```java
cdk deploy
```

정상적으로 인프라가 설치가 되면 아래와 같은 화면이 노출됩니다. 여기서 UploadUrl은 "https://d1kpgkk8y8p43t.cloudfront.net/upload.html" 이고, UpdateCommend는 "aws s3 cp ../html/upload.html s3://cdkstorytimestack-storage8d9329be-1of8fsmmt6vyc"입니다. 

![noname](https://user-images.githubusercontent.com/52392004/219975807-e13508f8-2e80-4620-ad84-3b63021bd3f0.png)



아래와 같이 "html/upload.html" 파일을 오픈하여 UploadUrl 정보를 이용하여 url을 업데이트 합니다. 

![noname](https://user-images.githubusercontent.com/52392004/219948314-514d5c3c-8e9e-4682-9bdc-a41c00d381a4.png)

이제 수정한 upload.html 파일을 아래와 같이 S3 bucket에 복사합니다. 이때의 명령어는 UpdateCommend를 참고합니다.

```java
aws s3 cp ../html/upload.html s3://cdkstorytimestack-storage8d9329be-1of8fsmmt6vyc
```

인프라를 설치하고 나면, CDK 라이브러리에 등록한 이메일 주소로 Confirmation 메시지가 전달됩니다. 이메일을 열어서 아래와 같이 [Confirm subscription]을 선택합니다.

![noname](https://user-images.githubusercontent.com/52392004/219817649-108b5c81-8460-49e3-a4bd-9af1dd5b091b.png)

정상적으로 진행되면 아래와 같은 결과를 얻습니다.

![noname](https://user-images.githubusercontent.com/52392004/219817719-ea749a1a-1b90-406b-94e0-6c28eddb928e.png)



### 실행하기 



## 리소스 정리하기 

더이상 인프라를 사용하지 않는 경우에 아래처럼 모든 리소스를 삭제할 수 있습니다. 

```java
cdk destroy
```
