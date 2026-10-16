"use client";
interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  questionType?: "behavioral" | "coding";
}
interface ChatContainerProps {
  messages: Message[];
  isLoading: boolean;
}
const ChatContainer = ({ messages, isLoading }: ChatContainerProps) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
      {messages.length === 0 && !isLoading && (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>Start an interview to begin</p>
        </div>
      )}
      {messages.map((message) => {
        const isCodingQuestion =
          !message.isUser && message.questionType === "coding";
        return (
          <div
            key={message.id}
            className={`flex ${message.isUser ? "justify-end" : "justify-start"} mb-4`}
          >
            <div
              className={`${isCodingQuestion ? "max-w-md lg:max-w-lg" : "max-w-xs lg:max-w-md"} px-4 py-2 rounded-lg ${
                message.isUser
                  ? "bg-blue-500 text-white rounded-br-none"
                  : "bg-gray-200 text-gray-900 rounded-bl-none"
              }`}
            >
              {isCodingQuestion && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-100 rounded-full px-2 py-0.5 mb-1.5">
                  🖥️ Coding Question
                </span>
              )}
              <p
                className={`text-sm ${isCodingQuestion ? "whitespace-pre-wrap" : ""}`}
              >
                {message.content}
              </p>
            </div>
          </div>
        );
      })}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg rounded-bl-none">
            <p className="text-sm">AI is thinking...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatContainer;
