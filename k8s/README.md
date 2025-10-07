You'll need the postgres operator installed:

    helm repo add postgres-operator-charts https://opensource.zalando.com/postgres-operator/charts/postgres-operator
    helm install postgres-operator postgres-operator-charts/postgres-operator
