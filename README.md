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


## ChatGPT AI를 위한 인터페이스

[2023년 3월에 ChatGPT API가 오픈](https://openai.com/blog/introducing-chatgpt-and-whisper-apis)되어서 Lex와 연동할 수 있게 되었습니다. 새로운 API의 경로는  "/v1/chat/completions"이며, "gpt-3.5-turbo" 모델을 사용합니다. 이 모델은 기존 모델인 "text-davinci-003"에 비하여, 90% 낮은 비용으로 활용할 수 있으나 ChatGPT에서 날씨를 검색한거나 하는 작업은 할 수 없습니다. 

### gpt-3.5-turbo 모델 사용하기 

[OpenAI가 제공하는 ChatGPT API](https://platform.openai.com/docs/api-reference/chat)인 "v1/chat/completions"로 HTTPS POST로 요청을 수행합니다. 이를 위해 여기서는 fetch를 사용합니다. 이때 ChatGPT에 전달하는 요청의 header에는 아래와 같이 Authorization과 Content-Type을 포함하여야 합니다. Authorization에 필요한 API Key는 [OpenAPI: API Key](https://platform.openai.com/account/api-keys)에서 발급받아서 환경변수로 저장하여 사용합니다. 메시지 요청시 role로 "user", 

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


### text-davinci-003 모델 사용하기 

"v1/completions"을 사용합니다. 
[Completion API](https://platform.openai.com/docs/api-reference/completions)
