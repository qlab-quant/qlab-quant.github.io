> 이 글은 리서치 글 형식을 보여 주는 **예시**예요. 숫자는 모두 자리 표시(XX)이니, 실제 리서치로 바꿔 주세요.

## 요약

지난 12개월 수익률에서 최근 1개월을 뺀 **12-1 모멘텀**이 국내 주식 시장에서도 초과 수익을 내는지 검증합니다. 거래비용을 반영한 뒤에도 성과가 남는지가 핵심 질문입니다.

## 가설

과거에 많이 오른 종목이 앞으로도 상대적으로 더 오른다. 단, 최근 1개월은 단기 반전 효과가 있어 제외한다.

## 방법

종목 $i$의 시점 $t$ 모멘텀 점수는 다음과 같이 정의합니다.

$$
\text{MOM}_{i,t} = \prod_{k=2}^{12} \left(1 + r_{i,t-k}\right) - 1
$$

매월 말 점수 상위 10% 종목을 동일 비중으로 매수하고, 하위 10%와의 수익률 차이 $R_{\text{WML}} = R_{\text{Winner}} - R_{\text{Loser}}$ 를 봅니다.

## 결과

| 구간 | 연 수익률 | 연 변동성 | 샤프 지수 | 최대 낙폭 |
| --- | --- | --- | --- | --- |
| 상위 10% | XX.X% | XX.X% | X.XX | XX.X% |
| 하위 10% | XX.X% | XX.X% | X.XX | XX.X% |
| 차이 (WML) | XX.X% | XX.X% | X.XX | XX.X% |

그림은 관리 페이지의 **그림 넣기** 버튼으로 올리면 이렇게 들어갑니다.

```text
![누적 수익률 그래프](research/images/그림파일.png)
```

## 코드

백테스트에 쓴 핵심 코드는 아래와 같고, 전체 코드는 연결된 GitHub 저장소에 있어요.

```python
import pandas as pd

def momentum_score(prices: pd.DataFrame) -> pd.DataFrame:
    """12-1 모멘텀: 최근 1개월을 뺀 11개월 누적 수익률"""
    monthly = prices.resample("M").last()
    return monthly.shift(1) / monthly.shift(12) - 1
```

## 결론과 한계

- 거래비용과 생존 편향을 반영했는지 적어 주세요.
- 다음 학기에 이어서 볼 질문을 남겨 주세요.

## 참고 자료

1. Jegadeesh, N., & Titman, S. (1993). Returns to Buying Winners and Selling Losers. *The Journal of Finance*.
