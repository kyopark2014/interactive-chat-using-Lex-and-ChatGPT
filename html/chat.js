var host = 'localhost';

// Documents
const title = document.querySelector('#title');
const sendBtn = document.querySelector('#sendBtn');
const message = document.querySelector('#chatInput')
const newConversation = document.querySelector('#newConversation');  // To input callee number
const newParticipant = document.querySelector('#refer');  // To input callee number

const chatPanel = document.querySelector('#chatPanel');

HashMap = function() {
    this.map = new Array();
};

HashMap.prototype = {
    put: function(key, value) {
        this.map[key] = value;
    },
    get: function(key) {
        return this.map[key];
    },
    getAll: function() {
        return this.map;
    },
    clear: function() {
        return this.map;
    },
    isEmpty: function() {
        return (this.map.size()==0);
    },
    remove: function(key) {
        delete this.map[key];
    },
    getKeys: function() {
        var keys = new Array();
        for(i in this.map) {
            keys.push(i);
        }
        return keys;
    }
};

// message log list
var msglist = [];
var maxMsgItems = 50;
var msgHistory = new HashMap();
var callee = "John";
var index=0;

for (i=0;i<maxMsgItems;i++) {
    msglist.push(document.getElementById('msgLog'+i));

    // add listener        
    (function(index) {
        msglist[index].addEventListener("click", function() {
            if(msglist.length < maxMsgItems) i = index;
            else i = index + maxMsgItems;

            console.log('click! index: '+index);
        })
    })(i);
}

calleeName.textContent = "ChatGPT";  
calleeId.textContent = "OpenAI";

index = 0;

addNotifyMessage("start the interractive chat");

// Listeners
message.addEventListener('keyup', function(e){
    if (e.keyCode == 13) {
        onSend(e);
    }
});

refreshChatWindow.addEventListener('click', function(){
    console.log('update chat window');
    updateChatWindow(callee);
});

sendBtn.addEventListener('click', onSend);
function onSend(e) {
    e.preventDefault();
    
    if(message.value != '') {
        console.log("msg: ", message.value);
        addSentMessage(message.value);
    }
    else {
        console.log("msg: ", "empty!");
    }    
    message.value = "";

    chatPanel.scrollTop = chatPanel.scrollHeight;  // scroll needs to move bottom
}

function uuidv4() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

(function() {
    window.addEventListener("focus", function() {
//        console.log("Back to front");

        if(msgHistory.get(callee))
            updateCallLogToDisplayed();
    })
})();

function addSentMessage(text) {
    console.log("sent message: "+text);

    var date = new Date();
    var timestr = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
    index++;

    msglist[index].innerHTML = 
        `<div class="chat-sender chat-sender--right"><h1>${timestr}</h1>${text}&nbsp;<h2 id="status${index}"></h2></div>`;   

    sendRequest(text);    
}       

function addReceivedMessage(msg) {
    // console.log("add received message: "+msg);
    sender = "ChatGPT"
    var date = new Date();
    var timestr = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
    index++;

    // msglist[index].innerHTML =  `<div class="chat-receiver chat-receiver--left"><h1>${sender}</h1><h2>${timestr}</h2>${msg}&nbsp;</div>`;     
    msglist[index].innerHTML = `<div class="chat-receiver chat-receiver--left"><h1>${sender}</h1>${msg}&nbsp;</div>`;  
}

function addNotifyMessage(msg) {
    index++;

    msglist[index].innerHTML =  
        `<div class="notification-text">${msg}</div>`;     
}

refreshChatWindow.addEventListener('click', function(){
    console.log('update chat window');
    // updateChatWindow(callee);
});

attachFile.addEventListener('click', function(){
    console.log('click: attachFile');
    // var input = $(document.createElement('input')); 
    // input.attr("type", "file");
    // input.trigger('click');
    // return false;
});

function sendRequest(text) {
    const uri = "https://d3ndv6lhze8yc5.cloudfront.net/chat";
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
