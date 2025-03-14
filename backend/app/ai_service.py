import os
from typing import Optional
import requests
import json
import traceback
from app.config import settings

class AIService:
    """Service for AI-powered article summarization"""
    
    def __init__(self, api_key: Optional[str] = None):
        # Use DeepSeek API by default
        self.use_deepseek = True
        self.api_key = api_key
        
        # DeepSeek API settings
        self.deepseek_api_url = settings.DEEPSEEK_API_URL
        self.deepseek_api_token = settings.DEEPSEEK_API_TOKEN
        self.deepseek_api_model = settings.DEEPSEEK_API_MODEL
        
        # Legacy API settings (for backward compatibility)
        self.sankuai_api_url = settings.SANKUAI_API_URL
        self.sankuai_api_token = settings.SANKUAI_API_TOKEN
        self.sankuai_api_model = settings.SANKUAI_API_MODEL
        self.openai_api_url = "https://api.openai.com/v1/chat/completions"
    
    def summarize_article(self, content: str) -> str:
        """
        Summarize an article using AI API
        """
        try:
            # Use DeepSeek API by default
            if self.use_deepseek:
                summary = self._summarize_with_deepseek(content)
                if summary:
                    return summary
                
            # Fallback to Sankuai API if DeepSeek fails
            summary = self._summarize_with_sankuai(content)
            if summary:
                return summary
            
            # Fallback to OpenAI if specified and other APIs fail
            if self.api_key:
                summary = self._summarize_with_openai(content)
                if summary:
                    return summary
        except Exception as e:
            print(f"Error in summarize_article: {str(e)}")
            traceback.print_exc()
        
        # Use simple summary if all APIs fail
        return self._simple_summary(content)
    
    def _summarize_with_deepseek(self, content: str) -> str:
        """
        Summarize an article using DeepSeek API
        """
        try:
            print("Attempting to summarize with DeepSeek API...")
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.deepseek_api_token}"
            }
            
            # Prepare the prompt
            prompt = f"""
            请用2-3句话总结以下markdown文章，重点关注主要内容和关键点：
            
            {content}
            """
            
            data = {
                "model": self.deepseek_api_model,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that summarizes articles concisely."},
                    {"role": "user", "content": prompt}
                ],
                "stream": False
            }
            
            try:
                response = requests.post(
                    self.deepseek_api_url,
                    headers=headers,
                    json=data,  # Use json parameter instead of data with json.dumps
                    timeout=30
                )
                
                print(f"DeepSeek API response status: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    if 'choices' in result and len(result['choices']) > 0:
                        summary = result["choices"][0]["message"]["content"].strip()
                        print(f"DeepSeek API summary: {summary[:50]}...")
                        return summary
                    else:
                        print(f"Unexpected DeepSeek API response format: {result}")
                else:
                    print(f"Error from DeepSeek API: {response.status_code}, {response.text}")
            except requests.exceptions.RequestException as req_err:
                print(f"Request error with DeepSeek API: {str(req_err)}")
                
            # If we reach here, there was an issue with the API call
            print("DeepSeek API call failed, falling back to other methods")
            return ""
                
        except Exception as e:
            print(f"Error calling DeepSeek API: {str(e)}")
            traceback.print_exc()
            return ""
    
    def _summarize_with_sankuai(self, content: str) -> str:
        """
        Summarize an article using Sankuai API with streaming response (legacy method)
        """
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.sankuai_api_token}"
            }
            
            # Prepare the prompt
            prompt = f"""
            请用2-3句话总结以下markdown文章，重点关注主要内容和关键点：
            
            {content}
            """
            
            data = {
                "model": self.sankuai_api_model,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "stream": True
            }
            
            try:
                response = requests.post(
                    self.sankuai_api_url,
                    headers=headers,
                    data=json.dumps(data),
                    stream=True,
                    timeout=30
                )
                
                if response.status_code == 200:
                    # Process streaming response
                    summary = ""
                    for line in response.iter_lines():
                        if not line:
                            continue
                        
                        # Convert bytes to string and remove 'data: ' prefix
                        line_str = line.decode('utf-8')
                        if line_str.startswith('data: '):
                            line_str = line_str[6:]
                        
                        # Check for end of stream
                        if line_str == '[DONE]':
                            break
                        
                        try:
                            # Parse JSON and extract content
                            chunk = json.loads(line_str)
                            if 'choices' in chunk and len(chunk['choices']) > 0:
                                delta = chunk['choices'][0].get('delta', {})
                                if 'content' in delta:
                                    summary += delta['content']
                        except json.JSONDecodeError:
                            print(f"Error parsing JSON: {line_str}")
                    
                    if summary:
                        return summary.strip()
                    else:
                        print("No content received from Sankuai API, using fallback")
                        return self._simple_summary(content)
                else:
                    print(f"Error from Sankuai API: {response.status_code}, {response.text}")
                    return self._simple_summary(content)
            except requests.exceptions.RequestException as req_err:
                print(f"Request error with Sankuai API: {str(req_err)}")
                return self._simple_summary(content)
                
        except Exception as e:
            print(f"Error calling Sankuai API: {str(e)}")
            return self._simple_summary(content)
    
    def _summarize_with_openai(self, content: str) -> str:
        """
        Summarize an article using OpenAI API (legacy method)
        """
        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            # Prepare the prompt for the OpenAI API
            prompt = f"""
            Please summarize the following markdown article in 2-3 sentences, 
            focusing on the key points and main ideas:
            
            {content}
            """
            
            data = {
                "model": "gpt-3.5-turbo",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that summarizes articles concisely."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 150
            }
            
            response = requests.post(
                self.openai_api_url,
                headers=headers,
                data=json.dumps(data),
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                summary = result["choices"][0]["message"]["content"].strip()
                return summary
            else:
                print(f"Error from OpenAI API: {response.status_code}, {response.text}")
                return self._simple_summary(content)
                
        except Exception as e:
            print(f"Error calling OpenAI API: {str(e)}")
            return self._simple_summary(content)
    
    def _simple_summary(self, content: str) -> str:
        """Fallback method for summarization when API is not available"""
        # Extract the first paragraph that's not a heading
        lines = content.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith('#'):
                return f"This is an auto-generated summary: {line[:200]}..."
        
        return "No summary available."
