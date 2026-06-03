# AI 엔지니어링 용어집

## A

### Agent
- **What people say:** "스스로 생각하고 행동하는 자율 AI"
- **What it actually means:** LLM이 다음에 어떤 도구를 호출할지 정하고, 실행하고, 결과를 본 뒤 이걸 반복하는 while 루프
- **Why it's called that:** 철학에서 빌려온 말이다. "에이전트(agent)"는 세상에서 행동할 수 있는 무언가를 뜻한다. AI에서는 그냥 "LLM + 도구 + 루프"를 의미한다

### Attention
- **What people say:** "AI가 중요한 부분에 집중하는 방식"
- **What it actually means:** 모든 토큰이 다른 모든 토큰의 값(value)을 가중합하는 메커니즘. 가중치는 각 토큰이 얼마나 관련 있는지에 따라 정해진다(쿼리(query)와 키(key) 벡터의 내적으로 계산)
- **Why it's called that:** 2017년 논문 "Attention Is All You Need"가 인간의 선택적 주의(attention)에 빗대 붙인 이름이다

### Alignment
- **What people say:** "AI를 안전하게 만드는 것"
- **What it actually means:** AI 시스템의 행동을 인간의 의도, 가치, 선호에 맞추는 기술적 과제. 설계자가 미처 예상하지 못한 예외 상황까지 포함한다

### Autoregressive
- **What people say:** "AI가 한 단어씩 생성하는 것"
- **What it actually means:** 앞선 모든 토큰을 조건으로 다음 토큰을 예측하고, 그 예측을 다시 입력으로 넣어 다음 단계로 넘기는 모델. GPT, LLaMA, Claude 모두 자기회귀(autoregressive) 방식이다.

### Activation Function
- **What people say:** "레이어 사이에 들어가는 비선형 뭔가"
- **What it actually means:** 각 선형 레이어 뒤에 적용되어 비선형성을 넣어 주는 함수. 이게 없으면 선형 레이어를 아무리 쌓아도 결국 하나의 선형 변환으로 무너진다. ReLU, GELU, SiLU가 가장 흔하다. 어떤 걸 고르느냐가 학습 중 그래디언트(gradient)가 잘 흐르는지를 직접 좌우한다.

### Adam (Optimizer)
- **What people say:** "기본 옵티마이저"
- **What it actually means:** Adaptive Moment Estimation(적응적 모멘트 추정). 모멘텀(1차 모멘트)과 파라미터별 적응 학습률(2차 모멘트)을 결합한다. 초기 스텝을 위한 편향 보정이 들어 있다. 별다른 튜닝 없이도 대부분의 작업에서 잘 동작한다.

### AdamW
- **What people say:** "Adam인데 더 나은 거"
- **What it actually means:** 가중치 감쇠(weight decay)를 분리한 Adam. 표준 Adam에서는 L2 정규화가 파라미터별 적응 학습률에 곱해져 버리는데, 이건 원하는 동작이 아니다. AdamW는 그래디언트 통계와 무관하게 가중치 감쇠를 가중치에 직접 적용한다. 트랜스포머(transformer) 학습의 기본 옵티마이저다.

### Autograd
- **What people say:** "자동 그래디언트"
- **What it actually means:** 텐서(tensor)에 가해진 연산을 기록해 두고 역방향 모드 미분으로 그래디언트를 자동 계산하는 시스템. PyTorch의 autograd는 계산 그래프를 즉석에서(동적 그래프) 만들고, JAX는 함수 변환(grad)을 쓴다. 이게 바로 역전파(backprop)를 실용적으로 만들어 준다. 순전파(forward pass)만 짜면 프레임워크가 모든 미분을 계산해 준다.

## B

### Batch Size
- **What people say:** "한 번에 처리하는 예제 개수"
- **What it actually means:** 가중치를 갱신하기 전에 한 번의 순전파/역전파에서 처리하는 학습 예제의 수. 배치가 클수록 그래디언트 추정이 더 안정적이지만 메모리를 더 쓴다. 보통 학습에는 32~512, 추론에는 그보다 크게 잡는다. 배치 크기는 학습률과 상호작용한다. 배치를 두 배로 하면 학습률도 두 배로(선형 스케일링 규칙).

### Backpropagation
- **What people say:** "신경망이 학습하는 방식"
- **What it actually means:** 각 가중치가 오차에 얼마나 기여했는지를 연쇄 법칙(chain rule)을 네트워크 뒤쪽으로 적용해 계산하고, 그에 비례해 가중치를 조정하는 알고리즘
- **Why it's called that:** 오차가 출력에서 입력 쪽으로 레이어를 거슬러 한 층씩 전파(propagate)되기 때문이다

## C

### Context Window
- **What people say:** "AI가 기억할 수 있는 양"
- **What it actually means:** 한 번의 API 호출에 들어가는 토큰(입력 + 출력)의 최대 개수. 기억이 아니라, 호출할 때마다 초기화되는 고정 크기 버퍼다

### Chain of Thought (CoT)
- **What people say:** "AI가 단계별로 생각하게 만드는 것"
- **What it actually means:** 모델에게 추론 단계를 풀어 보여 달라고 요청하는 프롬프트 기법. 각 단계가 다음 토큰 생성의 조건이 되므로 여러 단계가 필요한 문제에서 정확도가 올라간다

### CNN (Convolutional Neural Network)
- **What people say:** "이미지 AI"
- **What it actually means:** 합성곱 연산(입력 위로 필터를 미끄러뜨리는 것)을 써서 국소적 패턴을 찾아내는 신경망. 합성곱을 쌓을수록 점점 더 복잡한 특징을 잡아낸다. 가장자리, 질감, 사물 순으로.

### CUDA
- **What people say:** "GPU 프로그래밍"
- **What it actually means:** NVIDIA의 병렬 컴퓨팅 플랫폼. 수천 개의 GPU 코어에서 행렬 연산을 동시에 돌릴 수 있게 해 준다. PyTorch와 TensorFlow가 내부적으로 CUDA를 쓴다.

### Chunking
- **What people say:** "문서를 조각으로 나누는 것"
- **What it actually means:** 검색을 위해 임베딩(embedding)하기 전에 텍스트를 조각으로 쪼개는 일. 청크 크기가 검색 결과의 입도를 결정한다. 너무 작으면 맥락을 잃고, 너무 크면 관련성이 희석된다. 흔한 전략은 겹침을 둔 고정 크기, 문장 단위, 또는 의미 기반 분할이다. 보통 256~512 토큰에 10~20% 겹침을 둔다.

### Contrastive Learning
- **What people say:** "비교로 배우는 것"
- **What it actually means:** 비슷한 쌍은 임베딩 공간에서 더 가까이 당기고 다른 쌍은 더 멀리 밀어내며 학습하는 방식. CLIP이 이걸 쓴다. 짝이 맞는 이미지-텍스트 쌍 대 안 맞는 쌍을 대비시킨다.

### Cosine Similarity
- **What people say:** "두 벡터가 얼마나 비슷한지"
- **What it actually means:** 두 벡터가 이루는 각의 코사인 값. dot(a, b) / (||a|| * ||b||). -1(정반대)에서 1(같은 방향)까지의 범위를 가진다. 크기는 무시하고 방향만 본다. 임베딩과 의미 검색(semantic search)의 표준 유사도 지표다.

### Cross-Entropy
- **What people say:** "분류 손실"
- **What it actually means:** 두 확률 분포 사이의 차이를 재는 값. 분류에서는 -sum(y_true * log(y_pred)). 언어 모델에서는 정답인 다음 토큰의 음의 로그 확률. 낮을수록 좋다. 펄플렉시티(perplexity)는 그냥 exp(cross-entropy)다.

## D

### Data Augmentation
- **What people say:** "학습 데이터를 더 만드는 것"
- **What it actually means:** 기존 데이터를 변형한 사본을 만들어(이미지 회전, 노이즈 추가, 텍스트 바꿔 쓰기) 새 데이터를 수집하지 않고도 학습셋의 다양성을 늘리는 것. 과적합(overfitting)을 줄여 준다.

### Decoder
- **What people say:** "출력 담당 부분"
- **What it actually means:** 트랜스포머에서 디코더는 인과적(마스킹된) 셀프 어텐션(self-attention)을 써서 각 위치가 앞쪽 위치만 참조하게 한다. GPT는 디코더 전용이다. BERT는 인코더 전용. T5는 인코더-디코더.

### Diffusion Model
- **What people say:** "노이즈에서 이미지를 만들어 내는 AI"
- **What it actually means:** 점진적으로 노이즈를 더하는 과정을 거꾸로 되돌리도록 학습한 모델. 노이즈를 예측해 제거하는 법을 배우고, 생성할 때는 순수한 노이즈에서 출발해 반복적으로 노이즈를 걷어낸다

### DPO (Direct Preference Optimization)
- **What people say:** "더 간단한 RLHF"
- **What it actually means:** 보상 모델을 통째로 건너뛰는 학습 기법. 인간 선호 쌍에서 더 나은 응답을 선호하도록 언어 모델을 곧바로 최적화한다

### Dropout
- **What people say:** "뉴런을 무작위로 꺼 버리는 것"
- **What it actually means:** 학습 중에 일정 비율의 활성값을 무작위로 0으로 만든다. 네트워크가 특정 뉴런 하나에 의존하지 않도록 강제한다. 추론 때는 끈다. 단순하지만 효과적인 정규화다.

## E

### Eigenvalue
- **What people say:** "PCA에 나오는 수학 뭔가"
- **What it actually means:** 행렬 A에 대해, 어떤 벡터 v가 Av = lambda*v를 만족할 때 lambda가 고윳값이다. 그 방향으로 행렬이 벡터를 얼마나 늘리는지를 알려 준다. 큰 고윳값 = 데이터에서 분산이 큰 방향.

### Embedding
- **What people say:** "단어를 숫자로 바꾸는 AI 마법 같은 것"
- **What it actually means:** 이산적인 항목(단어, 이미지, 사용자)을 연속 공간의 밀집 벡터로 옮기는, 학습된 사상(mapping). 비슷한 항목끼리 가까이 모인다
- **Why it's called that:** 거리에 의미가 있는 기하 공간에 항목들이 "박혀(embed)" 들어가기 때문이다

### Encoder
- **What people say:** "입력 담당 부분"
- **What it actually means:** 트랜스포머에서 인코더는 양방향 셀프 어텐션을 써서 각 위치가 모든 위치를 참조할 수 있게 한다. BERT는 인코더 전용이다. 이해 과제(분류, 개체명 인식)에는 좋지만 생성에는 맞지 않는다.

### Epoch
- **What people say:** "데이터를 한 번 훑는 것"
- **What it actually means:** 말 그대로다. 학습셋의 모든 예제를 한 번 완전히 훑는 것. 여러 에폭 = 데이터를 여러 번 보는 것. 에폭이 많을수록 학습이 좋아질 수 있지만 과적합 위험도 커진다.

## F

### Feature
- **What people say:** "데이터의 한 열(column)"
- **What it actually means:** 데이터의 측정 가능한 개별 속성. 고전적 ML에서는 특징을 사람이 손으로 설계한다. 딥러닝에서는 네트워크가 원본 데이터에서 특징을 자동으로 학습한다.

### Few-Shot
- **What people say:** "AI한테 예시부터 좀 주는 것"
- **What it actually means:** 모델에게 작업을 시키기 전에 프롬프트 안에 입력-출력 예시를 소수 포함시키는 것. 보통 3~5개. 모델은 이 예시들을 패턴 매칭해서 원하는 형식과 동작을 이해한다. 제로샷(zero-shot, 예시 없음), 파인튜닝(fine-tuning, 수천 개 예시를 가중치에 새겨 넣음)과 대비된다.

### Fine-tuning
- **What people say:** "AI를 내 데이터로 학습시키는 것"
- **What it actually means:** 사전학습된 모델의 가중치에서 출발해, 더 작은 작업 특화 데이터셋으로 학습을 이어 가는 것. 기존 가중치만 갱신할 뿐, 맨바닥부터 새 지식을 더하지는 않는다

### Function Calling
- **What people say:** "도구를 쓸 수 있는 AI"
- **What it actually means:** LLM이 외부 함수 실행을 요청하는 구조화된 방식. JSON Schema 설명으로 도구를 정의하면, 모델이 어떤 함수를 어떤 인자로 호출할지 명시한 구조화된 JSON 객체를 출력하고, 네 코드가 그걸 실행해 결과를 모델에 되돌려 준다. 에이전트와는 다르다. 함수 호출은 메커니즘이고, 에이전트는 그 루프다.

## G

### Guardrails
- **What people say:** "AI용 안전 필터"
- **What it actually means:** LLM을 둘러싸고 유해 콘텐츠, 프롬프트 인젝션 시도, 개인정보(PII) 유출, 주제 이탈 응답을 탐지·차단하는 입출력 검증 계층. 보통 입력 필터 -> LLM -> 출력 필터로 이어지는 파이프라인이다. 규칙 기반(정규식, 키워드 목록)일 수도, 모델 기반(안전성을 점수 매기는 분류기)일 수도 있다.

### GPT
- **What people say:** "ChatGPT" 또는 "그 AI"
- **What it actually means:** Generative Pre-trained Transformer. 대규모 텍스트 코퍼스로 학습한 디코더 전용 트랜스포머로 다음 토큰을 예측하는 특정 아키텍처
- **Why it's called that:** Generative(텍스트를 생성), Pre-trained(대규모 데이터로 한 번 학습한 뒤 적응), Transformer(아키텍처)

### GAN (Generative Adversarial Network)
- **What people say:** "AI 둘이 서로 싸우는 것"
- **What it actually means:** 생성자 네트워크는 진짜 같은 데이터를 만들려 하고, 판별자 네트워크는 진짜와 가짜를 가려내려 한다. 둘은 함께 학습한다. 생성자는 판별자를 속이는 데 점점 능해지고, 판별자는 가짜를 잡아내는 데 점점 능해진다.

### Gradient
- **What people say:** "기울기"
- **What it actually means:** 가장 가파르게 증가하는 방향을 가리키는 편미분들의 벡터. ML에서는 손실을 줄이려고 그래디언트의 반대 방향으로 간다(경사 하강).

### Gradient Descent
- **What people say:** "AI가 좋아지는 방식"
- **What it actually means:** 손실 함수를 가장 가파르게 줄이는 방향으로 파라미터를 조정하는 최적화 알고리즘. 고차원 지형에서 내리막을 걸어 내려가는 것과 같다

## H

### Hyperparameter
- **What people say:** "네가 조정하는 설정값"
- **What it actually means:** 학습 과정 자체를 제어하기 위해 학습 전에 정해 두는 값들. 학습률, 배치 크기, 레이어 수, 드롭아웃 비율 등. 모델 파라미터(가중치)와 달리 데이터로부터 학습되지 않는다.

### Hallucination
- **What people say:** "AI가 거짓말한다" 또는 "지어낸다"
- **What it actually means:** 모델이 학습 데이터나 주어진 맥락에 근거하지 않은, 그럴듯한 텍스트를 만들어 내는 것. 사실을 찾아오는 게 아니라 패턴을 이어 붙이는 것이다

## I

### Inference
- **What people say:** "AI를 돌리는 것"
- **What it actually means:** 학습된 모델로 새 데이터에 대해 예측을 만드는 것. 가중치 갱신은 일어나지 않는다. 프로덕션에서 하는 일이 바로 이거다. 입력을 보내고 출력을 받는다.

### Inductive Bias
- **What people say:** 들어 본 적 없음
- **What it actually means:** 모델 아키텍처에 내장된 가정들. CNN은 국소 패턴이 중요하다고 가정한다(합성곱). RNN은 순서가 중요하다고 가정한다(순차 처리). 트랜스포머는 모든 것이 모든 것과 연관될 수 있다고 가정한다(어텐션). 맞는 편향은 더 적은 데이터로 더 빨리 학습하게 돕는다.

### JAX
- **What people say:** "구글의 ML 프레임워크"
- **What it actually means:** NumPy 호환 라이브러리에 자동 미분(grad), JIT 컴파일(jit), 자동 벡터화(vmap), 멀티 디바이스 병렬화(pmap)를 더한 것. PyTorch의 객체지향 스타일과 달리 JAX는 순수 함수형이다. 숨은 상태도, 인플레이스 변형도 없다. 구글 딥마인드가 AlphaFold, Gemini, 대규모 연구에 쓴다.

## K

### KV Cache
- **What people say:** "추론을 빠르게 해 주는 것"
- **What it actually means:** 자기회귀 생성 중에 이전 토큰들의 키(key)·값(value) 행렬을 캐시해 두어 매 스텝마다 다시 계산하지 않게 하는 것. 메모리를 내주고 속도를 얻는다. 빠른 LLM 추론에 필수다.

## L

### Latent Space
- **What people say:** "숨은 표현"
- **What it actually means:** 비슷한 입력이 가까운 점으로 사상되는, 압축되고 학습된 표현 공간. 오토인코더, VAE, 디퓨전 모델 모두 잠재 공간에서 동작한다. 입력보다 차원이 낮지만 중요한 구조는 담아낸다.

### Learning Rate
- **What people say:** "AI가 얼마나 빨리 배우는지"
- **What it actually means:** 경사 하강 중 스텝 크기를 제어하는 스칼라. 너무 크면 최솟값을 지나쳐 발산한다. 너무 작으면 너무 느리게 수렴하거나 갇혀 버린다. 가장 중요한 단 하나의 하이퍼파라미터다.

### LLM (Large Language Model)
- **What people say:** "AI" 또는 "두뇌"
- **What it actually means:** 시퀀스에서 다음 토큰을 예측하도록 학습된, 수십억 개 파라미터를 가진 트랜스포머 기반 신경망. 인터넷 규모의 텍스트 데이터로 학습한다

### LoRA (Low-Rank Adaptation)
- **What people say:** "효율적인 파인튜닝"
- **What it actually means:** 모든 가중치를 갱신하는 대신, 원래 가중치 옆에 작은 저랭크 행렬을 끼워 넣는 것. 이 작은 행렬만 학습하므로 메모리를 10~100배 줄인다

### Loss Function
- **What people say:** "AI가 얼마나 틀렸는지"
- **What it actually means:** 예측값과 실제값 사이의 간극을 재는 함수. 학습은 이 함수를 최소화한다. 회귀에는 MSE, 분류에는 교차 엔트로피(cross-entropy), 임베딩에는 대조 손실(contrastive loss). 손실 함수를 어떻게 고르느냐가 모델에게 "좋다"가 무엇인지 정의한다.

## M

### Mixed Precision
- **What people say:** "속도용 학습 트릭"
- **What it actually means:** 순전파와 대부분의 연산에는 float16을 쓰고(더 빠르고 메모리도 덜 든다), 그래디언트 누적과 가중치 갱신에는 float32를 유지하는 것(더 정밀하다). 정확도 손실은 무시할 만하면서 2배 속도 향상을 얻는다.

### MoE (Mixture of Experts)
- **What people say:** "모델 일부만 돌아가는 것"
- **What it actually means:** 여러 "전문가" 서브네트워크를 두고, 라우팅 메커니즘이 각 입력을 그중 몇 개에게만 보내는 모델. 전체 모델은 거대하지만 대부분의 전문가를 건너뛰므로 한 번의 순전파는 저렴하다. Mixtral과 GPT-4가 이걸 쓴다.

### MCP (Model Context Protocol)
- **What people say:** "AI가 도구를 쓰는 방법"
- **What it actually means:** AI 애플리케이션이 외부 데이터 소스·도구에 연결되는 방식을 표준화한 개방형 프로토콜(stdio/HTTP 위의 JSON-RPC). 도구, 리소스, 프롬프트에 대한 타입 지정 스키마를 갖는다

## N

### NaN (Not a Number)
- **What people say:** "학습이 터졌다"
- **What it actually means:** 정의되지 않은 결과(0/0, inf-inf)를 나타내는 부동소수점 값. 학습에서 NaN 손실은 보통 학습률이 너무 높거나, 그래디언트가 폭발했거나, 0의 로그를 취했거나, 0으로 나눴다는 뜻이다. 학습이 실패하면 가장 먼저 확인할 것.

### Normalization
- **What people say:** "데이터를 스케일링하는 것"
- **What it actually means:** 값을 표준 범위로 맞추는 것. 배치 정규화는 배치 전체에 걸쳐 정규화한다. 레이어 정규화는 특징 전체에 걸쳐 정규화한다. 둘 다 학습을 안정시키고 더 높은 학습률을 허용한다.

## O

### Overfitting
- **What people say:** "모델이 데이터를 외워 버렸다"
- **What it actually means:** 모델이 학습 데이터에서는 잘하지만 못 본 데이터에서는 못하는 것. 신호가 아니라 노이즈를 학습한 것이다. 해결책은 데이터 늘리기, 정규화(드롭아웃, 가중치 감쇠), 조기 종료, 데이터 증강, 더 단순한 모델 등.

### Optimizer
- **What people say:** "가중치를 갱신하는 그것"
- **What it actually means:** 그래디언트를 써서 모델 파라미터를 갱신하는 알고리즘. SGD가 가장 단순하다. Adam이 가장 흔하다. 옵티마이저마다 수렴 속도, 메모리 사용량, 하이퍼파라미터 민감도 등 성질이 다르다.

## P

### Parameter
- **What people say:** "모델 크기"
- **What it actually means:** 모델 안의 학습 가능한 값. 보통 가중치 또는 편향이다. "70억(7B) 파라미터"는 학습 가능한 숫자가 70억 개라는 뜻이다. float32 파라미터 하나가 4바이트를 차지하므로 7B 파라미터 = 가중치만으로 28GB 메모리다.

### Perplexity
- **What people say:** "모델이 얼마나 헷갈려 하는지"
- **What it actually means:** 평균 교차 엔트로피 손실의 지수값. 낮을수록 좋다. 펄플렉시티 10은 모델이 매 스텝마다 10개 토큰 중에서 균등하게 고르는 것만큼 불확실하다는 뜻이다.

### Precision & Recall
- **What people say:** "정확도 지표"
- **What it actually means:** 정밀도(precision) = 네가 표시한 항목 중 맞은 게 몇 개인가. 재현율(recall) = 맞는 항목 전체 중 네가 찾아낸 게 몇 개인가. 둘은 맞바꿈 관계다. 스팸 메일을 하나도 안 놓치면(높은 재현율) 오경보가 늘어난다(낮은 정밀도). F1 점수는 둘의 조화 평균이다. 거짓 양성이 비쌀 땐 정밀도를, 거짓 음성이 비쌀 땐 재현율을 본다.

### Prompt Engineering
- **What people say:** "AI에게 제대로 말 거는 법"
- **What it actually means:** 원하는 출력을 안정적으로 끌어내도록 입력 텍스트를 설계하는 것. 시스템 프롬프트, 퓨샷 예시, 형식 지시, 사고의 사슬(chain-of-thought) 유발 등을 포함한다

### Prompt Injection
- **What people say:** "말로 AI를 해킹하는 것"
- **What it actually means:** 입력에 들어간 악의적 텍스트가 시스템 프롬프트나 지시를 무력화하는 공격. 직접 인젝션은 사용자가 "이전 지시는 무시해"라고 쓰는 것. 간접 인젝션은 검색해 온 문서에 숨은 지시가 박혀 있는 것. LLM판 SQL 인젝션이다. 완벽한 해법은 없고, 방어는 입력 검증, 출력 필터링, 권한 분리를 겹겹이 쌓는 것이다.

## Q

### QLoRA
- **What people say:** "LoRA인데 더 싼 것"
- **What it actually means:** 양자화된(Quantized) LoRA. 동결된 베이스 모델 가중치는 4비트 정밀도(NF4 형식)로 두고 LoRA 어댑터만 16비트로 학습한다. 표준 LoRA보다 메모리를 다시 3~4배 줄인다. LoRA로 14GB가 필요한 7B 모델이 QLoRA로는 4~6GB에 들어간다. 대부분의 벤치마크에서 전체 파인튜닝 대비 품질 차이가 1% 이내다.

## R

### RAG (Retrieval-Augmented Generation)
- **What people say:** "검색할 수 있는 AI"
- **What it actually means:** 지식 베이스에서 관련 문서를 (임베딩 유사도로) 검색해 와 프롬프트에 욱여넣고, LLM이 그 맥락을 바탕으로 답하게 하는 패턴
- **Why it's called that:** Retrieval(문서 찾기) + Augmented(프롬프트에 더하기) + Generation(LLM이 답을 작성)

### RLHF (Reinforcement Learning from Human Feedback)
- **What people say:** "AI를 도움 되게 만드는 방법"
- **What it actually means:** 학습 파이프라인이다. (1) 모델 출력에 대한 인간 선호를 수집하고, (2) 그 선호로 보상 모델을 학습하고, (3) PPO로 LLM이 더 높은 보상을 받는 출력을 내도록 최적화한다

### Quantization
- **What people say:** "모델을 더 작게 만드는 것"
- **What it actually means:** 모델 가중치의 정밀도를 float32(4바이트)에서 int8(1바이트)이나 int4(0.5바이트)로 낮추는 것. 약간의 정확도를 내주고 메모리를 4~8배 줄이며 추론을 빠르게 한다. GPTQ, AWQ, GGUF가 흔한 형식이다.

### ReLU
- **What people say:** "활성화 함수"
- **What it actually means:** Rectified Linear Unit: f(x) = max(0, x). 가장 단순한 비선형 활성화. 계산이 빠르고 양수 영역에서는 포화되지 않는다. 잘 동작하고 저렴해서 어디서나 쓴다. 변형으로 LeakyReLU, GELU, SiLU가 있다.

### ROUGE
- **What people say:** "요약 평가 지표"
- **What it actually means:** Recall-Oriented Understudy for Gisting Evaluation. 생성된 텍스트와 참조 텍스트 사이의 겹침을 잰다. ROUGE-1은 유니그램 일치, ROUGE-2는 바이그램 일치, ROUGE-L은 최장 공통 부분 수열을 센다. 계산은 싸지만 표면적 유사도만 잰다. 같은 뜻이라도 단어가 다른 두 문장은 낮은 점수를 받는다.

## S

### Semantic Search
- **What people say:** "의미를 이해하는 똑똑한 검색"
- **What it actually means:** 키워드 매칭이 아니라 의미로 문서를 찾는 것. 쿼리와 모든 문서를 같은 벡터 공간에 임베딩한 뒤, 임베딩이 쿼리에 가장 가까운 문서를 돌려준다. "payment failed"가 "transaction declined"를 찾아낸다. 공통 단어가 하나도 없는데도 말이다. 임베딩 모델 + 벡터 데이터베이스로 작동한다.

### Streaming
- **What people say:** "응답이 한 단어씩 나타나는 것"
- **What it actually means:** LLM이 완성된 응답을 기다리지 않고 토큰을 생성되는 대로 보내는 것. Server-Sent Events(SSE)나 WebSocket 프로토콜을 쓴다. 첫 토큰까지의 체감 지연을 수 초에서 수 밀리초로 줄인다. 프로덕션 채팅 인터페이스에 필수다. 각 청크는 델타(부분 토큰 또는 단어)를 담는다.

### Self-Attention
- **What people say:** "모델이 무엇에 집중할지 정하는 방식"
- **What it actually means:** 각 토큰이 쿼리, 키, 값 벡터를 계산한다. 두 토큰 사이의 어텐션 가중치 = 둘의 쿼리와 키의 내적을 스케일링하고 소프트맥스한 값. 출력 = 값 벡터들의 가중합. 모든 토큰이 다른 모든 토큰을 볼 수 있게 한다.

### SFT (Supervised Fine-Tuning)
- **What people say:** "모델이 지시를 따르도록 가르치는 것"
- **What it actually means:** 사전학습된 모델을 (지시, 응답) 쌍으로 파인튜닝하는 것. 모델은 지시가 주어졌을 때 응답을 생성하는 법을 배운다. 베이스 모델을 챗 모델로 바꿔 주는 게 바로 이것이다.

### Softmax
- **What people say:** "숫자를 확률로 바꾸는 것"
- **What it actually means:** softmax(x_i) = exp(x_i) / sum(exp(x_j)). 임의의 실수 벡터를 확률 분포(모두 양수, 합이 1)로 변환한다. 분류 헤드, 어텐션 가중치, 그리고 확률이 필요한 모든 곳에 쓴다.

### Swarm
- **What people say:** "벌떼처럼 함께 일하는 AI 에이전트 무리"
- **What it actually means:** 여러 에이전트가 상태를 공유하고 메시지 전달로 조율하는 것. 중앙 통제가 아니라 단순한 개별 규칙에서 창발적 행동이 나타난다

## T

### System Prompt
- **What people say:** "AI에게 주는 지시"
- **What it actually means:** 대화 맨 앞에서 모델의 행동, 페르소나, 제약을 설정하는 특별한 메시지. 사용자 메시지보다 먼저 처리된다. 대부분의 UI에서 사용자에게는 보이지 않는다. 모델이 무엇을 하고 하지 말아야 하는지, 어조, 형식 선호, 도메인 초점을 정의한다. 사용자 프롬프트와는 다르다. 시스템 프롬프트는 개발자가 설정한다.

### Tensor
- **What people say:** "다차원 배열"
- **What it actually means:** 딥러닝 프레임워크의 핵심 자료구조. 0차원 텐서는 스칼라, 1차원은 벡터, 2차원은 행렬, 3차원 이상은 텐서다. PyTorch와 JAX에서 텐서는 자동 미분을 위해 계산 이력을 추적하고 CPU나 GPU에 올라갈 수 있다. 신경망의 모든 입력, 출력, 가중치, 그래디언트가 텐서다.

### Token
- **What people say:** "단어"
- **What it actually means:** BPE 같은 토크나이저가 만들어 내는 서브워드 단위(영어에서는 보통 3~4글자). "unbelievable"은 "un" + "believ" + "able" 세 토큰일 수 있다

### Temperature
- **What people say:** "창의성 설정"
- **What it actually means:** 소프트맥스 전에 로짓(logit)을 나누는 스칼라. Temperature=1이 기본이다. 높을수록 = 분포가 평평해져 = 더 무작위적인 출력. 낮을수록 = 분포가 뾰족해져 = 더 결정적. Temperature=0은 argmax(항상 가장 가능성 높은 토큰을 고름)다.

### Transfer Learning
- **What people say:** "사전학습된 모델을 쓰는 것"
- **What it actually means:** 한 작업으로 학습한 모델을 가져와 다른 작업에 적응시키는 것. 앞쪽 레이어는 전이되는 일반적 특징(가장자리, 구문 패턴)을 학습한다. 뒤쪽 레이어만 작업 특화 학습이 필요하다. BERT를 어떤 NLP 작업에든 파인튜닝할 수 있는 이유가 이것이다.

### Transformer
- **What people say:** "현대 AI의 바탕이 되는 아키텍처"
- **What it actually means:** 재귀(recurrence) 대신 셀프 어텐션(모든 위치가 다른 모든 위치를 참조하게 함)으로 시퀀스를 처리하는 신경망 아키텍처. 대규모 병렬화를 가능하게 한다
- **Why it's called that:** 어텐션 레이어를 거쳐 입력 표현을 출력 표현으로 변환(transform)하기 때문이다

## U

### Underfitting
- **What people say:** "모델이 학습을 못 한다"
- **What it actually means:** 모델이 너무 단순해서 데이터의 패턴을 담아내지 못하는 것. 학습 손실이 높게 머문다. 해결책은 파라미터 늘리기, 레이어 늘리기, 더 오래 학습하기, 정규화 줄이기, 더 나은 특징 등.

## V

### VAE (Variational Autoencoder)
- **What people say:** "생성 모델"
- **What it actually means:** 인코더 출력이 가우시안 분포를 따르도록 강제해 매끄러운 잠재 공간을 학습하는 오토인코더. 이 분포에서 샘플링해 디코딩하면 새 데이터를 생성할 수 있다. 재매개변수화 트릭(reparameterization trick) 덕분에 역전파로 학습할 수 있다.

### Vector Database
- **What people say:** "AI를 위한 특별한 데이터베이스"
- **What it actually means:** 벡터(밀집 실수 배열)를 저장하고 빠른 근사 최근접 이웃 검색을 수행하도록 최적화된 데이터베이스. 유사도 검색, RAG, 추천 시스템의 핵심 연산이다.

## W

### Weight
- **What people say:** "모델이 학습한 것"
- **What it actually means:** 모델의 파라미터 행렬 안의 숫자 하나. 입력 크기 768, 출력 크기 3072인 선형 레이어는 768*3072 = 2,359,296개의 가중치를 가진다. 학습은 손실 함수를 최소화하도록 각 가중치를 조정한다.

### Weight Decay
- **What people say:** "정규화"
- **What it actually means:** 가중치의 크기에 비례하는 페널티를 손실 함수에 더하는 것. L2 정규화와 동등하다. 가중치가 너무 커지는 것을 막는다. 보통 값은 0.01~0.1이다.

## Z

### Zero-Shot
- **What people say:** "학습이 필요 없다"
- **What it actually means:** 명시적으로 학습한 적 없는 작업에, 프롬프트에 작업 특화 예시도 없이 모델을 쓰는 것. 모델은 사전학습으로부터 일반화한다. 큰 모델은 충분히 다양한 것을 봐 와서 새로운 작업 형식도 처리할 수 있기에 가능하다.
