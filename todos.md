Implementation status:

[x] Login / signup using email and password  
[x] One page where the list of learning methods is shown  
[x] Clicking on the learning methods open a new chat interface
[x] Show a start learning button on the learn tab. Clicking on this button should show the list of learning methods.  
[x] As soon as the learner enters the name of the topic, the first message should get automatically sent to the AI along with the system prompt and the topic name.
[x] Show chat history below the start learning button. The history can be fetched from the `chats` table for a user.


### Chat screen improvements
[x] Remove gifted chat and create our own chat interface. Have separate component for ChatScreen and ChatMessages. Ensure that everything is cleaned up properly after the component unmounts.
[x] Clicking on the chat box should bring it above the keyboard in mobile. Right now when I click on the input box, it is hidden behind the keyboard.
[x] The chat messages should render markdown properly
[x] Remove header "Learn" from chat page
[x] Fix status bar visibility on white/light backgrounds (ChatScreen, LearningMethodsList, and active chat sessions)
[x] The last message gets hidden from the bottom when typing the answer


### Features
[x] Add app icon
[ ] Update learning methods to use better system prompts
[ ] Handle math
[ ] Remove the completed button and instead add delete chat button there
[ ] Voice to text input using either google api or some other SOTA tool
[ ] Add a hard mode
[ ] Use Gemini 2.5 flash with thinking mode
[ ] For cloze questions which are new, there is an overlap. Also we can show cloze question in a better way by only showing the answer and then underlining the words which are going to be asked.

### Aesthetics
[ ] Decide on colors
[x] Top navigation
[ ] Convert the full app to dark mode


### Flashcards
[ ] use gemini 2.5 Pro with thinking mode
[x] use structured json output
[x] update the prompt to create learning based on concepts, not chat dependent stuff like what is prerequisite of what
[x] Ability to delete a flashcard
[x] Add the cron as well
[x] Test creation of flashcards after adding new messages
[ ] Long clicking on a flashcard should open a menu with options like Go to chat, delete.
The go to chat option will take them to the message from which the flashcard is generated.
[x] Don't remove the card unless it is flipped
[ ] Ability to edit a flashcard
[x] When flashcard generation fails, update the db with failure state rather than completed state.
[x] When a flashcard's answer is viewed, let the user swipe away even from front.
[ ] If there are no cards to review, don't show dummy cards. Just show, no more cards to review for today. Go learn new stuff.
[x] Swiping a card away makes an API call, need to make it fast via making the call async
[x] Change swipe actions up for easy and down for hard
[ ] Update the frontend to fetch the due cards when cards are about to end. If there are no due cards, show the next due date and time.
[ ] When someone opens the flashcards section for the first time, show them how they can swipe the card in different directions.
[x] Improve animations
[ ] Rename the swipe actions in the frontend. Left can be named: "Forgot".
Right can be named: "Knew it"
Top can be: "Got it easily"
Bottom can be: "Got it with effort"

[ ] Also, when the learner has just finished going through all the flashcards, the last screen should give a stat of how many cards did the user just go through.

Even when the user is going through cards, we can show a better progress indication.
[ ] When a card is swiped left, the fading animation should also be in left side. 

### Future features
[ ] Suggest new topics based on past topics 
[ ] Provide my own sources to learn
[ ] Add a notification for revision
[ ] Send the content from anywhere like URL, image etc
[ ] New learning modes and edit existing learning modes
Default learning mode: "You are a helpful tutor".


### More features
[x] Show NEW flashcards in ascending order

[ ] Generate flashcards instantly after a chat is finished.

[ ] How can we ignore questions on syllabus or prerequisites?

[ ] Let the learner move from a flashcard to a normal chat where they can expand on a card or learner can get their doubt resolved.

[ ] Make it work as a web app and deploy

[x] For a new card, as the learner has never seen it, do we need to hide the answer? Or is there a better way to show the answer directly?



### Security
[ ] Understand about RLS and implement it carefully
